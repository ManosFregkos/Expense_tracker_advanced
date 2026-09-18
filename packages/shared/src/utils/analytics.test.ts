import { describe, expect, it } from 'vitest'
import type { Transaction } from '../domain/types.js'
import { accountEffects, mergeAnalyticsDeltas, transactionAnalyticsDelta } from './analytics.js'

const now = new Date('2026-09-10T12:00:00.000Z')
const base = {
  id: 't',
  householdId: 'h',
  currency: 'EUR',
  description: 'Test',
  transactionDate: now,
  source: 'MANUAL' as const,
  createdBy: 'u',
  searchPrefixes: [],
  isDeleted: false,
  createdAt: now,
  updatedAt: now,
}

describe('transaction accounting', () => {
  it('counts expenses and income while excluding transfers', () => {
    const expense: Transaction = {
      ...base,
      type: 'EXPENSE',
      amountMinor: 500,
      accountId: 'a',
      ownerUserId: 'u',
      categoryId: 'c',
    }
    const income: Transaction = {
      ...base,
      id: 'i',
      type: 'INCOME',
      amountMinor: 1000,
      accountId: 'a',
      ownerUserId: 'u',
      categoryId: 'salary',
    }
    const transfer: Transaction = {
      ...base,
      id: 'x',
      type: 'TRANSFER',
      amountMinor: 200,
      transfer: { sourceAccountId: 'a', destinationAccountId: 'b' },
    }
    const total = mergeAnalyticsDeltas(
      transactionAnalyticsDelta(expense),
      transactionAnalyticsDelta(income),
      transactionAnalyticsDelta(transfer),
    )
    expect(total).toMatchObject({ incomeMinor: 1000, expenseMinor: 500, transactionCount: 2 })
    expect(accountEffects(transfer)).toEqual({ a: -200, b: 200 })
  })

  it('excludes soft-deleted records and reverses edits', () => {
    const before: Transaction = {
      ...base,
      type: 'EXPENSE',
      amountMinor: 500,
      accountId: 'a',
      ownerUserId: 'u',
      categoryId: 'c',
    }
    const after: Transaction = { ...before, amountMinor: 750 }
    const delta = mergeAnalyticsDeltas(
      transactionAnalyticsDelta(before, -1),
      transactionAnalyticsDelta(after),
    )
    expect(delta.expenseMinor).toBe(250)
    expect(
      transactionAnalyticsDelta({ ...after, isDeleted: true, deletedAt: now }).expenseMinor,
    ).toBe(0)
  })
})
