import { Timestamp } from 'firebase-admin/firestore'
import {
  householdIdSchema,
  mergeAnalyticsDeltas,
  monthKey,
  transactionAnalyticsDelta,
  type Household,
  type Transaction,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { applyDelta } from './analytics.js'
import { requireMember } from './permissions.js'

export const rebuildMonthlyAnalytics = secureCallable(householdIdSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
  const [householdSnapshot, transactionSnapshots, existingAnalytics] = await Promise.all([
    db.doc(`households/${input.householdId}`).get(),
    db.collection(`households/${input.householdId}/transactions`).get(),
    db.collection(`households/${input.householdId}/monthlyAnalytics`).get(),
  ])
  const household = householdSnapshot.data() as Household
  const aggregates = new Map<string, ReturnType<typeof transactionAnalyticsDelta>>()
  for (const snapshot of transactionSnapshots.docs) {
    const financialTransaction = snapshot.data() as Transaction
    const date =
      financialTransaction.transactionDate instanceof Date
        ? financialTransaction.transactionDate
        : financialTransaction.transactionDate.toDate()
    const key = monthKey(date, household.timeZone)
    aggregates.set(
      key,
      mergeAnalyticsDeltas(
        aggregates.get(key) ?? {
          incomeMinor: 0,
          expenseMinor: 0,
          transactionCount: 0,
          byCategory: {},
          byMember: {},
          byAccount: {},
          byMerchant: {},
        },
        transactionAnalyticsDelta(financialTransaction),
      ),
    )
  }

  const writer = db.bulkWriter()
  for (const snapshot of existingAnalytics.docs) void writer.delete(snapshot.ref)
  for (const [key, delta] of aggregates) {
    void writer.set(db.doc(`households/${input.householdId}/monthlyAnalytics/${key}`), {
      ...applyDelta(undefined, key, household.defaultCurrency, delta),
      updatedAt: Timestamp.now(),
    })
  }
  await writer.close()
  return { monthsRebuilt: aggregates.size, sourceTransactions: transactionSnapshots.size }
})
