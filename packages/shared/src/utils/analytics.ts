import type { MonthlyAnalytics, Transaction } from '../domain/types.js'

export type AnalyticsDelta = Omit<MonthlyAnalytics, 'currency' | 'monthKey' | 'updatedAt'>

export function emptyAnalyticsDelta(): AnalyticsDelta {
  return {
    incomeMinor: 0,
    expenseMinor: 0,
    transactionCount: 0,
    byCategory: {},
    byMember: {},
    byAccount: {},
    byMerchant: {},
    byTag: {},
  }
}

function addDimension(
  target: Record<string, number>,
  key: string | undefined,
  amount: number,
): void {
  if (key) target[key] = (target[key] ?? 0) + amount
}

export function transactionAnalyticsDelta(
  transaction: Transaction,
  direction: 1 | -1 = 1,
): AnalyticsDelta {
  const delta = emptyAnalyticsDelta()
  if (
    transaction.isDeleted ||
    transaction.deletedAt ||
    transaction.type === 'TRANSFER' ||
    transaction.excludeFromAnalytics
  )
    return delta
  const amount = transaction.amountMinor * direction
  delta.transactionCount = direction
  if (transaction.type === 'INCOME') delta.incomeMinor = amount
  if (transaction.type === 'EXPENSE') {
    delta.expenseMinor = amount
    if (transaction.splits?.length)
      for (const split of transaction.splits)
        addDimension(delta.byCategory, split.categoryId, split.amountMinor * direction)
    else addDimension(delta.byCategory, transaction.categoryId, amount)
    addDimension(delta.byMember, transaction.ownerUserId, amount)
    addDimension(delta.byAccount, transaction.accountId, amount)
    addDimension(delta.byMerchant, transaction.merchant?.trim().toLowerCase(), amount)
    for (const tag of transaction.tags ?? []) addDimension(delta.byTag ?? {}, tag, amount)
  }
  return delta
}

export function accountEffects(
  transaction: Transaction,
  direction: 1 | -1 = 1,
): Record<string, number> {
  if (transaction.isDeleted || transaction.deletedAt) return {}
  if (transaction.type === 'EXPENSE')
    return { [transaction.accountId]: -transaction.amountMinor * direction }
  if (transaction.type === 'INCOME')
    return { [transaction.accountId]: transaction.amountMinor * direction }
  return {
    [transaction.transfer.sourceAccountId]: -transaction.amountMinor * direction,
    [transaction.transfer.destinationAccountId]: transaction.amountMinor * direction,
  }
}

export function mergeAnalyticsDeltas(...deltas: AnalyticsDelta[]): AnalyticsDelta {
  const result = emptyAnalyticsDelta()
  for (const delta of deltas) {
    result.incomeMinor += delta.incomeMinor
    result.expenseMinor += delta.expenseMinor
    result.transactionCount += delta.transactionCount
    for (const key of ['byCategory', 'byMember', 'byAccount', 'byMerchant', 'byTag'] as const) {
      for (const [id, amount] of Object.entries(delta[key] ?? {}))
        if (result[key]) result[key][id] = (result[key][id] ?? 0) + amount
    }
  }
  return result
}

export function netCashflow(
  analytics: Pick<MonthlyAnalytics, 'incomeMinor' | 'expenseMinor'>,
): number {
  return analytics.incomeMinor - analytics.expenseMinor
}

export function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function averageMinor(values: number[]): number {
  return values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}
