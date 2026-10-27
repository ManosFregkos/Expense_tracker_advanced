import { createHash, randomUUID } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JarvisActionInput, JarvisChatInput } from '@family-expense-tracker/shared'
import { jarvisAction, jarvisChat } from './jarvis.js'
import { runJarvisAgent } from './jarvis-agent.js'

const store = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  writes: [] as string[],
  nextId: 0,
}))
vi.mock('./jarvis-agent.js', () => ({ runJarvisAgent: vi.fn() }))
vi.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => 'test-only' }),
  defineString: () => ({ value: () => 'test-model' }),
}))
vi.mock('../firebase.js', () => {
  const snapshot = (path: string) => {
    const data = store.documents.get(path)
    return {
      id: path.split('/').at(-1)!,
      exists: Boolean(data),
      data: () => data,
      get: (key: string) => data?.[key],
    }
  }
  const ref = (path: string) => ({
    path,
    id: path.split('/').at(-1)!,
    get: async () => snapshot(path),
  })
  const comparable = (value: unknown): number | string =>
    value instanceof Timestamp
      ? value.toMillis()
      : typeof value === 'number'
        ? value
        : typeof value === 'string' || typeof value === 'boolean'
          ? String(value)
          : ''
  const collection = (
    path: string,
    maximum = 1000,
    conditions: { field: string; op: string; value: unknown }[] = [],
    order?: { field: string; direction: string },
  ) => ({
    doc: () => ref(`${path}/generated-${++store.nextId}`),
    limit: (size: number) => collection(path, size, conditions, order),
    orderBy: (field: string, direction: string) =>
      collection(path, maximum, conditions, { field, direction }),
    where: (field: string, op: string, value: unknown) =>
      collection(path, maximum, [...conditions, { field, op, value }], order),
    get: async () => {
      const docs = [...store.documents.keys()]
        .filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
        .filter((key) =>
          conditions.every(({ field, op, value }) => {
            const actual = store.documents.get(key)?.[field]
            return op === '=='
              ? actual === value
              : op === '>='
                ? comparable(actual) >= comparable(value)
                : comparable(actual) < comparable(value)
          }),
        )
        .sort((left, right) => {
          if (!order) return 0
          const a = comparable(store.documents.get(left)?.[order.field])
          const b = comparable(store.documents.get(right)?.[order.field])
          const difference = a < b ? -1 : a > b ? 1 : left.localeCompare(right)
          return order.direction === 'asc' ? difference : -difference
        })
        .slice(0, maximum)
        .map(snapshot)
      return { docs, size: docs.length }
    },
  })
  return {
    db: {
      doc: ref,
      collection,
      runTransaction: async (callback: (value: unknown) => Promise<unknown>) => {
        const writes: {
          reference: { path: string }
          value: Record<string, unknown>
          update: boolean
        }[] = []
        const result = await callback({
          get: async (reference: { path: string }) => {
            if (writes.length) throw new Error('Firestore read after write')
            return snapshot(reference.path)
          },
          set: (reference: { path: string }, value: Record<string, unknown>) =>
            writes.push({ reference, value, update: false }),
          update: (reference: { path: string }, value: Record<string, unknown>) =>
            writes.push({ reference, value, update: true }),
        })
        writes.forEach(({ reference, value, update }) => {
          store.documents.set(
            reference.path,
            update ? { ...store.documents.get(reference.path), ...value } : value,
          )
          store.writes.push(reference.path)
        })
        return result
      },
    },
  }
})
function request(data: unknown, uid = 'u1', verified = true) {
  return {
    data,
    auth: { uid, token: { email: 'member@example.test', email_verified: verified } },
  } as Parameters<typeof jarvisChat.run>[0]
}
let input: JarvisChatInput
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const requestPath = () => `privateJarvisRequests/${hash(`u1:h1:${input.requestId}`)}`
const actionInput = (decision: JarvisActionInput['decision'] = 'CONFIRM'): JarvisActionInput => ({
  householdId: 'h1',
  sessionId: input.sessionId,
  requestId: input.requestId,
  decision,
})
const proposal = {
  kind: 'CREATE_TRANSACTION',
  data: {
    type: 'EXPENSE',
    amount: '30.00',
    currency: 'EUR',
    accountId: 'a1',
    categoryId: 'groceries',
    description: 'Supermarket',
    date: '2026-10-27',
  },
} as const
beforeEach(() => {
  vi.clearAllMocks()
  store.documents.clear()
  store.writes = []
  store.nextId = 0
  input = {
    householdId: 'h1',
    sessionId: randomUUID(),
    requestId: randomUUID(),
    message: 'Add 30 euro supermarket',
    language: 'en-US',
    defaultAccountId: 'a1',
  }
  store.documents.set('households/h1', {
    id: 'h1',
    timeZone: 'Europe/Athens',
    defaultCurrency: 'EUR',
  })
  store.documents.set('households/h1/members/u1', { userId: 'u1', role: 'MEMBER' })
  store.documents.set('households/h1/accounts/a1', {
    id: 'a1',
    name: 'Cash',
    ownerUserId: 'u1',
    type: 'CASH',
    currency: 'EUR',
    currentBalanceMinor: 0,
    isArchived: false,
  })
  store.documents.set('households/h1/categories/groceries', {
    id: 'groceries',
    name: 'Groceries',
    type: 'EXPENSE',
    isArchived: false,
  })
  vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
    await options.validate(proposal)
    return { reply: '', proposal }
  })
})
async function previewDeletion() {
  const deletion = { kind: 'DELETE_TRANSACTION', data: { transactionId: 't1' } } as const
  vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
    await options.search({
      query: 'supermarket',
      amount: '30',
      currency: 'EUR',
      accountId: null,
      date: null,
      type: 'EXPENSE',
    })
    await options.validate(deletion)
    return { reply: '', proposal: deletion }
  })
  store.documents.set('households/h1/transactions/t1', {
    id: 't1',
    householdId: 'h1',
    type: 'EXPENSE',
    amountMinor: 3000,
    currency: 'EUR',
    description: 'Supermarket',
    accountId: 'a1',
    ownerUserId: 'u1',
    categoryId: 'groceries',
    transactionDate: Timestamp.fromDate(new Date('2026-10-26T12:00:00Z')),
    updatedAt: Timestamp.now(),
    isDeleted: false,
  })
  return jarvisChat.run(request(input))
}
describe('Jarvis server actions', () => {
  it('uses explicit euros even if the model proposes dollars', async () => {
    input.message = 'add 30 euros expense'
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      expect(options.transactionCurrency).toBe('EUR')
      const wrongCurrency = { ...proposal, data: { ...proposal.data, currency: 'USD' } }
      await options.validate(wrongCurrency)
      return { reply: '', proposal: wrongCurrency }
    })
    const response = await jarvisChat.run(request(input))
    expect(response.action?.summary).toContain('€30.00')
    const result = await jarvisAction.run(request(actionInput()))
    expect(store.documents.get(`households/h1/transactions/${result.entityId}`)).toMatchObject({
      amountMinor: 3000,
      currency: 'EUR',
    })
  })
  it('does not silently convert an explicitly requested foreign currency into euros', async () => {
    input.message = 'add 30 dollars supermarket'
    await expect(jarvisChat.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    expect(store.writes.every((path) => !path.startsWith('households/'))).toBe(true)
  })
  it.each(['OLDEST', 'NEWEST', 'VISIBLE'] as const)(
    'selects a transaction by %s order without amount/category filters',
    async (order) => {
      const old = Timestamp.fromDate(new Date('2020-01-01T12:00:00Z'))
      const recent = Timestamp.fromDate(new Date('2026-10-27T12:00:00Z'))
      const base = {
        householdId: 'h1',
        type: 'EXPENSE',
        amountMinor: 700,
        currency: 'EUR',
        description: 'Anything',
        accountId: 'a1',
        ownerUserId: 'u1',
        categoryId: 'groceries',
        updatedAt: Timestamp.now(),
        isDeleted: false,
      }
      store.documents.set('households/h1/transactions/old', {
        ...base,
        id: 'old',
        transactionDate: old,
      })
      store.documents.set('households/h1/transactions/new', {
        ...base,
        id: 'new',
        transactionDate: recent,
      })
      store.documents.set('households/h1/transactions/other-owner', {
        ...base,
        id: 'other-owner',
        ownerUserId: 'u2',
        transactionDate: Timestamp.now(),
      })
      store.documents.set('households/h1/transactions/deleted', {
        ...base,
        id: 'deleted',
        isDeleted: true,
        transactionDate: old,
      })
      input.message = 'delete my first transaction'
      if (order === 'VISIBLE') input.visibleTransactionIds = ['old', 'new']
      const expected = order === 'NEWEST' ? 'new' : 'old'
      vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
        const selection = (await options.select!({ order, position: 1, mineOnly: true })) as {
          matches: { id: string }[]
        }
        expect(selection.matches[0]?.id).toBe(expected)
        const deletion = { kind: 'DELETE_TRANSACTION', data: { transactionId: expected } } as const
        await options.validate(deletion)
        return { reply: '', proposal: deletion }
      })
      const response = await jarvisChat.run(request(input))
      expect(response.action?.summary).toContain('Anything')
      expect(store.documents.get(`households/h1/transactions/${expected}`)?.isDeleted).toBe(false)
      await jarvisAction.run(request(actionInput()))
      expect(store.documents.get(`households/h1/transactions/${expected}`)?.isDeleted).toBe(true)
    },
  )
  it('does not fall back to another transaction when the visible list is empty', async () => {
    input.visibleTransactionIds = []
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      const selection = (await options.select!({
        order: 'VISIBLE',
        position: 1,
        mineOnly: true,
      })) as { matches: unknown[] }
      expect(selection.matches).toEqual([])
      return { reply: 'There are no visible transactions.', proposal: null }
    })
    expect((await jarvisChat.run(request(input))).action).toBeNull()
  })
  it('converts salary income to minor units and increases the normal income analytics', async () => {
    const income = {
      ...proposal,
      data: {
        ...proposal.data,
        type: 'INCOME',
        amount: '1500',
        categoryId: 'salary',
        description: 'Salary',
      },
    } as const
    store.documents.set('households/h1/categories/salary', {
      id: 'salary',
      name: 'Salary',
      type: 'INCOME',
      isArchived: false,
    })
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      await options.validate(income)
      return { reply: '', proposal: income }
    })
    await jarvisChat.run(request(input))
    await jarvisAction.run(request(actionInput()))
    expect(store.documents.get('households/h1/monthlyAnalytics/2026-10')).toMatchObject({
      incomeMinor: 150000,
      expenseMinor: 0,
    })
    expect(store.documents.get('households/h1/accounts/a1')?.appCalculatedBalanceMinor).toBe(150000)
  })
  it('rejects direct deletion proposals without a search', async () => {
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      const deletion = { kind: 'DELETE_TRANSACTION', data: { transactionId: 't1' } } as const
      await options.validate(deletion)
      return { reply: '', proposal: deletion }
    })
    await expect(jarvisChat.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
  it('prepares without financial writes, then commits accounting and receipt atomically; retries do not duplicate', async () => {
    const response = await jarvisChat.run(request(input))
    expect(response.action?.kind).toBe('CREATE_TRANSACTION')
    expect(store.writes.every((path) => !path.startsWith('households/'))).toBe(true)
    const result = await jarvisAction.run(request(actionInput()))
    expect(result.status).toBe('COMPLETED')
    expect(store.documents.get(`households/h1/transactions/${result.entityId}`)).toMatchObject({
      amountMinor: 3000,
      ownerUserId: 'u1',
    })
    expect(store.documents.get('households/h1/monthlyAnalytics/2026-10')).toMatchObject({
      expenseMinor: 3000,
      transactionCount: 1,
    })
    const writes = [...store.writes]
    expect(await jarvisAction.run(request(actionInput()))).toEqual(result)
    expect(store.writes).toEqual(writes)
    expect(await jarvisChat.run(request(input))).toEqual(response)
    expect(runJarvisAgent).toHaveBeenCalledOnce()
  })
  it('soft deletes an exact confirmed record through the normal accounting service', async () => {
    await previewDeletion()
    expect(store.documents.get('households/h1/transactions/t1')?.isDeleted).toBe(false)
    await jarvisAction.run(request(actionInput()))
    expect(store.documents.get('households/h1/transactions/t1')?.isDeleted).toBe(true)
    expect(store.documents.get('households/h1/accounts/a1')?.appCalculatedBalanceMinor).toBe(3000)
  })
  it('rejects a stale deletion preview without financial writes', async () => {
    await previewDeletion()
    store.documents.get('households/h1/transactions/t1')!.updatedAt = Timestamp.fromMillis(
      Date.now() + 1000,
    )
    const writes = [...store.writes]
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'aborted',
    })
    expect(store.writes).toEqual(writes)
  })
  it('requires an unambiguous search and refuses arbitrary or duplicate deletion targets', async () => {
    await previewDeletion()
    input.requestId = randomUUID()
    store.documents.set('households/h1/transactions/t2', {
      ...store.documents.get('households/h1/transactions/t1'),
      id: 't2',
    })
    await expect(jarvisChat.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    expect(store.documents.get('households/h1/transactions/t1')?.isDeleted).toBe(false)
  })
  it('refuses a seemingly unique deletion when the search window is truncated', async () => {
    await previewDeletion()
    input.requestId = randomUUID()
    for (let index = 0; index < 100; index += 1)
      store.documents.set(`households/h1/transactions/other-${index}`, {
        ...store.documents.get('households/h1/transactions/t1'),
        description: 'Unrelated purchase',
      })
    await expect(jarvisChat.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
  it('cancels without writing financial data and cannot confirm a cancelled proposal', async () => {
    await jarvisChat.run(request(input))
    expect((await jarvisAction.run(request(actionInput('CANCEL')))).status).toBe('CANCELLED')
    expect((await jarvisAction.run(request(actionInput()))).status).toBe('CANCELLED')
    expect(store.writes.every((path) => !path.startsWith('households/'))).toBe(true)
  })
  it('rechecks membership, actor identity, session binding, expiry, and email verification', async () => {
    await jarvisChat.run(request(input))
    await expect(jarvisAction.run(request(actionInput(), 'outsider'))).rejects.toMatchObject({
      code: 'permission-denied',
    })
    await expect(
      jarvisAction.run(request({ ...actionInput(), sessionId: randomUUID() })),
    ).rejects.toMatchObject({ code: 'not-found' })
    await expect(jarvisAction.run(request(actionInput(), 'u1', false))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    store.documents.get(requestPath())!.actionExpiresAt = Timestamp.fromMillis(0)
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    store.documents.delete('households/h1/members/u1')
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })
  it('revalidates archived accounts and request IDs before committing', async () => {
    await jarvisChat.run(request(input))
    await expect(
      jarvisChat.run(request({ ...input, message: 'Different request' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    store.documents.get('households/h1/accounts/a1')!.isArchived = true
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    expect(store.writes.every((path) => !path.startsWith('households/'))).toBe(true)
  })
  it('creates todos in the existing task module with an idempotent receipt', async () => {
    const task = {
      kind: 'CREATE_TASK',
      data: {
        title: 'Buy milk',
        listId: null,
        dueDate: '2026-10-28',
        dueTime: null,
        priority: 'HIGH',
      },
    } as const
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      await options.validate(task)
      return { reply: '', proposal: task }
    })
    await jarvisChat.run(request(input))
    const result = await jarvisAction.run(request(actionInput()))
    expect(store.documents.get(`households/h1/tasks/${result.entityId}`)).toMatchObject({
      title: 'Buy milk',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: '2026-10-28',
    })
    const writes = [...store.writes]
    expect(await jarvisAction.run(request(actionInput()))).toEqual(result)
    expect(store.writes).toEqual(writes)
  })
})
