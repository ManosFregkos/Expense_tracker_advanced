import { Timestamp, type DocumentData } from 'firebase-admin/firestore'
import {
  emptyAnalyticsDelta,
  mergeAnalyticsDeltas,
  type AnalyticsDelta,
  type MonthlyAnalytics,
} from '@family-expense-tracker/shared'

export function applyDelta(
  current: DocumentData | undefined,
  month: string,
  currency: string,
  delta: AnalyticsDelta,
): MonthlyAnalytics {
  const base: AnalyticsDelta = current
    ? {
        incomeMinor: Number(current.incomeMinor ?? 0),
        expenseMinor: Number(current.expenseMinor ?? 0),
        transactionCount: Number(current.transactionCount ?? 0),
        byCategory: { ...(current.byCategory as Record<string, number> | undefined) },
        byMember: { ...(current.byMember as Record<string, number> | undefined) },
        byAccount: { ...(current.byAccount as Record<string, number> | undefined) },
        byMerchant: { ...(current.byMerchant as Record<string, number> | undefined) },
      }
    : emptyAnalyticsDelta()
  const merged = mergeAnalyticsDeltas(base, delta)
  for (const key of ['byCategory', 'byMember', 'byAccount', 'byMerchant'] as const) {
    for (const [id, amount] of Object.entries(merged[key])) if (amount === 0) delete merged[key][id]
  }
  return { ...merged, currency, monthKey: month, updatedAt: Timestamp.now() }
}
