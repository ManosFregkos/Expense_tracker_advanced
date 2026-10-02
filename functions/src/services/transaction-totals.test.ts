import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTransactionTotals } from './transaction-totals.js'
import { requireMember } from './permissions.js'

const store = vi.hoisted(() => ({
  documents: [] as Record<string, unknown>[],
  paths: [] as string[],
}))
vi.mock('../firebase.js', () => ({
  db: {
    collection: (path: string) => {
      store.paths.push(path)
      const filters: Array<[string, string, unknown]> = []
      const query = {
        where: (field: string, operator: string, value: unknown) => {
          filters.push([field, operator, value])
          return query
        },
        orderBy: () => query,
        select: () => query,
        stream: async function* () {
          const comparable = (value: unknown) =>
            value instanceof Timestamp ? value.toMillis() : value
          for (const document of store.documents) {
            const matches = filters.every(([field, operator, value]) => {
              const actual = document[field]
              if (operator === '==') return actual === value
              if (operator === 'in') return (value as unknown[]).includes(actual)
              if (operator === 'array-contains')
                return Array.isArray(actual) && actual.includes(value)
              if (operator === '>=') return Number(comparable(actual)) >= Number(comparable(value))
              if (operator === '<') return Number(comparable(actual)) < Number(comparable(value))
              return false
            })
            if (matches) yield { data: () => document }
          }
        },
      }
      return query
    },
  },
}))
vi.mock('./permissions.js', () => ({ requireMember: vi.fn(async () => undefined) }))

const base = {
  isDeleted: false,
  type: 'EXPENSE',
  currency: 'EUR',
  amountMinor: 100,
  accountId: 'a1',
  ownerUserId: 'u1',
  categoryId: 'c1',
  searchPrefixes: ['lidl'],
  transactionDate: Timestamp.fromDate(new Date('2026-10-02T12:00:00Z')),
}
function request(data: unknown) {
  return {
    data,
    auth: { uid: 'u1', token: { email: 'member@example.test', email_verified: true } },
  } as Parameters<typeof getTransactionTotals.run>[0]
}
beforeEach(() => {
  store.documents = []
  store.paths = []
  vi.clearAllMocks()
})

describe('transaction totals', () => {
  it('totals all matching records beyond a list page, excluding deleted and unsupported records', async () => {
    store.documents = [
      ...Array.from({ length: 31 }, () => ({ ...base })),
      { ...base, type: 'INCOME', amountMinor: 10000 },
      { ...base, isDeleted: true, amountMinor: 999999 },
      { ...base, type: 'TRANSFER', amountMinor: 999999 },
    ]
    expect(await getTransactionTotals.run(request({ householdId: 'h1' }))).toEqual({
      transactionCount: 32,
      byCurrency: [{ currency: 'EUR', expenseMinor: 3100, incomeMinor: 10000, netMinor: 6900 }],
    })
    expect(requireMember).toHaveBeenCalledWith('h1', 'u1')
    expect(store.paths).toEqual(['households/h1/transactions'])
  })

  it('combines date, type, account, member, category and normalized search filters', async () => {
    store.documents = [
      { ...base },
      { ...base, type: 'INCOME' },
      { ...base, accountId: 'a2' },
      { ...base, ownerUserId: 'u2' },
      { ...base, categoryId: 'c2' },
      { ...base, searchPrefixes: ['other'] },
      { ...base, transactionDate: Timestamp.fromDate(new Date('2026-11-01T00:00:00Z')) },
      { ...base, transactionDate: Timestamp.fromDate(new Date('2026-09-30T23:59:59Z')) },
    ]
    const result = await getTransactionTotals.run(
      request({
        householdId: 'h1',
        start: '2026-10-01T00:00:00Z',
        end: '2026-11-01T00:00:00Z',
        type: 'EXPENSE',
        accountId: 'a1',
        memberId: 'u1',
        categoryId: 'c1',
        search: 'LÍDL shopping',
      }),
    )
    expect(result).toEqual({
      transactionCount: 1,
      byCurrency: [{ currency: 'EUR', incomeMinor: 0, expenseMinor: 100, netMinor: -100 }],
    })
  })

  it('keeps currencies separate and returns an empty summary when nothing matches', async () => {
    store.documents = [{ ...base }, { ...base, currency: 'USD', type: 'INCOME', amountMinor: 800 }]
    expect((await getTransactionTotals.run(request({ householdId: 'h1' }))).byCurrency).toEqual([
      { currency: 'EUR', incomeMinor: 0, expenseMinor: 100, netMinor: -100 },
      { currency: 'USD', incomeMinor: 800, expenseMinor: 0, netMinor: 800 },
    ])
    expect(
      await getTransactionTotals.run(request({ householdId: 'h1', search: 'missing' })),
    ).toEqual({ transactionCount: 0, byCurrency: [] })
  })

  it('checks membership before accessing transactions', async () => {
    vi.mocked(requireMember).mockRejectedValueOnce(new Error('Access denied'))
    await expect(getTransactionTotals.run(request({ householdId: 'h1' }))).rejects.toThrow(
      'Access denied',
    )
    expect(store.paths).toEqual([])
  })
})
