import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTransaction, deleteTransaction, updateTransaction } from './transactions.js'

const store = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  reads: [] as string[],
  writes: new Map<string, Record<string, unknown>>(),
}))

vi.mock('../firebase.js', () => {
  const reference = (path: string) => ({ path, id: path.split('/').at(-1)! })
  const transaction = {
    get: vi.fn(async (ref: { path: string }) => {
      store.reads.push(ref.path)
      const data = store.documents.get(ref.path)
      return { exists: Boolean(data), data: () => data, get: (key: string) => data?.[key] }
    }),
    set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      store.writes.set(ref.path, data)
    }),
    update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      store.writes.set(ref.path, data)
    }),
  }
  return {
    db: {
      doc: reference,
      collection: (path: string) => ({ doc: () => reference(`${path}/audit`) }),
      runTransaction: async (handler: (value: typeof transaction) => Promise<unknown>) =>
        handler(transaction),
    },
  }
})
vi.mock('./permissions.js', () => ({ requireMember: vi.fn(async () => undefined) }))

const date = '2026-09-20T12:00:00.000Z'
const transactionPath = 'households/h1/transactions/t1'
const analyticsPath = 'households/h1/monthlyAnalytics/2026-09'

function request(data: unknown) {
  return {
    data,
    auth: { uid: 'u1', token: { email: 'member@example.test', email_verified: true } },
  } as Parameters<typeof deleteTransaction.run>[0]
}

beforeEach(() => {
  store.documents.clear()
  store.writes.clear()
  store.reads.length = 0
  store.documents.set('households/h1', { id: 'h1', timeZone: 'UTC', defaultCurrency: 'EUR' })
  store.documents.set('households/h1/accounts/a1', {
    id: 'a1',
    ownerUserId: 'u1',
    type: 'BANK',
    currency: 'EUR',
    currentBalanceMinor: -500,
  })
  store.documents.set('households/h1/members/u1', { userId: 'u1' })
  store.documents.set('households/h1/categories/c1', { type: 'EXPENSE', isArchived: false })
  store.documents.set(analyticsPath, {
    expenseMinor: 500,
    incomeMinor: 0,
    transactionCount: 1,
    byCategory: { c1: 500 },
    byMember: { u1: 500 },
    byAccount: { a1: 500 },
  })
  store.documents.set(transactionPath, {
    id: 't1',
    householdId: 'h1',
    type: 'EXPENSE',
    accountId: 'a1',
    ownerUserId: 'u1',
    categoryId: 'c1',
    amountMinor: 500,
    currency: 'EUR',
    description: 'Purchase',
    transactionDate: Timestamp.fromDate(new Date(date)),
    source: 'MANUAL',
    bankTransactionId: 'legacy-bank-id',
    isDeleted: false,
    createdBy: 'u1',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
})

describe('historical bank-linked transactions after banking removal', () => {
  it('allows amount edits and updates analytics without accessing bank collections', async () => {
    await updateTransaction.run(
      request({
        householdId: 'h1',
        transactionId: 't1',
        transaction: {
          type: 'EXPENSE',
          amountMinor: 700,
          currency: 'EUR',
          description: 'Updated purchase',
          transactionDate: date,
          accountId: 'a1',
          ownerUserId: 'u1',
          categoryId: 'c1',
        },
      }),
    )
    expect(store.writes.get(transactionPath)?.amountMinor).toBe(700)
    expect(store.writes.get(analyticsPath)?.expenseMinor).toBe(700)
    expect(store.reads.every((path) => !path.includes('/bankTransactions/'))).toBe(true)
  })

  it.each(['MANUAL', 'BANK_SYNC'])(
    'allows deleting a %s transaction without bank reads or writes',
    async (source) => {
      store.documents.get(transactionPath)!.source = source
      await deleteTransaction.run(request({ householdId: 'h1', transactionId: 't1' }))
      expect(store.writes.get(transactionPath)?.isDeleted).toBe(true)
      expect(store.writes.get(analyticsPath)?.expenseMinor).toBe(0)
      expect(
        [...store.reads, ...store.writes.keys()].every(
          (path) => !path.includes('/bankTransactions/'),
        ),
      ).toBe(true)
    },
  )
})

describe('supported transaction types', () => {
  it('rejects transfer creation before writing financial data', async () => {
    await expect(
      createTransaction.run(
        request({
          householdId: 'h1',
          type: 'TRANSFER',
          amountMinor: 100,
          currency: 'EUR',
          description: 'Unsupported movement',
          transactionDate: date,
          sourceAccountId: 'a1',
          destinationAccountId: 'a2',
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(store.writes.size).toBe(0)
  })

  it.each(['edit', 'delete'])('prevents %s of unsupported historical records', async (action) => {
    store.documents.set(transactionPath, {
      ...store.documents.get(transactionPath),
      type: 'TRANSFER',
      transfer: { sourceAccountId: 'a1', destinationAccountId: 'a2' },
    })
    const data = { householdId: 'h1', transactionId: 't1' }
    const operation =
      action === 'delete'
        ? deleteTransaction.run(request(data))
        : updateTransaction.run(
            request({
              ...data,
              transaction: {
                type: 'EXPENSE',
                amountMinor: 100,
                currency: 'EUR',
                description: 'Updated purchase',
                transactionDate: date,
                accountId: 'a1',
                ownerUserId: 'u1',
                categoryId: 'c1',
              },
            }),
          )
    await expect(operation).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(store.writes.size).toBe(0)
  })
})
