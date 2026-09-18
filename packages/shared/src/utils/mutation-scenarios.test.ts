import { describe, expect, it } from 'vitest'
import type { Transaction } from '../domain/types.js'
import { accountEffects, mergeAnalyticsDeltas, transactionAnalyticsDelta } from './analytics.js'
import { monthKey } from './date.js'

const date = new Date('2026-08-31T12:00:00Z')
const expense: Transaction = {
  id: 't',
  householdId: 'h',
  type: 'EXPENSE',
  amountMinor: 1000,
  currency: 'EUR',
  accountId: 'a',
  ownerUserId: 'u',
  categoryId: 'c',
  description: 'Groceries',
  transactionDate: date,
  source: 'MANUAL',
  createdBy: 'u',
  searchPrefixes: [],
  isDeleted: false,
  createdAt: date,
  updatedAt: date,
}

describe('financial mutation scenarios', () => {
  it('reverses the old month and applies a new month after a date move', () => {
    const moved: Transaction = {
      ...expense,
      amountMinor: 1500,
      transactionDate: new Date('2026-09-01T12:00:00Z'),
    }
    const august = transactionAnalyticsDelta(expense, -1)
    const september = transactionAnalyticsDelta(moved)
    expect(monthKey(date)).toBe('2026-08')
    expect(monthKey(moved.transactionDate as Date)).toBe('2026-09')
    expect(august.expenseMinor).toBe(-1000)
    expect(september.expenseMinor).toBe(1500)
  })

  it('updates account effects when amount changes', () => {
    const changed: Transaction = { ...expense, amountMinor: 1250 }
    const before = accountEffects(expense, -1)
    const after = accountEffects(changed)
    expect((before.a ?? 0) + (after.a ?? 0)).toBe(-250)
    expect(
      mergeAnalyticsDeltas(
        transactionAnalyticsDelta(expense, -1),
        transactionAnalyticsDelta(changed),
      ).expenseMinor,
    ).toBe(250)
  })

  it('delete reverses and restore reapplies a source transaction', () => {
    const deleted: Transaction = {
      ...expense,
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: 'u',
    }
    const restored: Transaction = { ...deleted, isDeleted: false }
    delete restored.deletedAt
    delete restored.deletedBy
    expect(transactionAnalyticsDelta(deleted).expenseMinor).toBe(0)
    expect(transactionAnalyticsDelta(expense, -1).expenseMinor).toBe(-1000)
    expect(transactionAnalyticsDelta(restored).expenseMinor).toBe(1000)
  })
})
