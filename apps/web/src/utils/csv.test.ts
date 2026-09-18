import { describe, expect, it } from 'vitest'
import { transactionsToCsv } from './csv'

describe('CSV export', () => {
  it('escapes descriptions and preserves integer amounts', () => {
    const date = new Date('2026-09-18T10:00:00Z')
    const csv = transactionsToCsv(
      [
        {
          id: 't',
          householdId: 'h',
          type: 'EXPENSE',
          amountMinor: 7243,
          currency: 'EUR',
          accountId: 'a',
          ownerUserId: 'u',
          categoryId: 'c',
          description: 'Food, weekly',
          transactionDate: date,
          source: 'MANUAL',
          createdBy: 'u',
          searchPrefixes: [],
          isDeleted: false,
          createdAt: date,
          updatedAt: date,
        },
      ],
      [{ userId: 'u', householdId: 'h', displayName: 'Emmanouil', role: 'OWNER', joinedAt: date }],
      [
        {
          id: 'a',
          householdId: 'h',
          ownerUserId: 'u',
          name: 'Eurobank',
          type: 'BANK',
          currency: 'EUR',
          openingBalanceMinor: 0,
          currentBalanceMinor: -7243,
          isArchived: false,
          createdAt: date,
          updatedAt: date,
        },
      ],
      [
        {
          id: 'c',
          householdId: 'h',
          name: 'Supermarket',
          type: 'EXPENSE',
          isSystem: true,
          isArchived: false,
        },
      ],
    )
    expect(csv).toContain('"Food, weekly"')
    expect(csv).toContain(',7243,EUR')
  })
})
