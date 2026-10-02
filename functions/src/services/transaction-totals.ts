import { Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import {
  normalizeSearchText,
  addMinor,
  transactionTotalsSchema,
  type TransactionTotals,
  type Transaction,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { requireMember } from './permissions.js'

export const getTransactionTotals = secureCallable(
  transactionTotalsSchema,
  async (input, actor): Promise<TransactionTotals> => {
    await requireMember(input.householdId, actor.uid)
    let query = db
      .collection(`households/${input.householdId}/transactions`)
      .where('isDeleted', '==', false)
      .orderBy('transactionDate', 'desc')
    if (input.start)
      query = query.where('transactionDate', '>=', Timestamp.fromDate(new Date(input.start)))
    if (input.end)
      query = query.where('transactionDate', '<', Timestamp.fromDate(new Date(input.end)))
    if (input.accountId) query = query.where('accountId', '==', input.accountId)
    if (input.memberId) query = query.where('ownerUserId', '==', input.memberId)
    if (input.categoryId) query = query.where('categoryId', '==', input.categoryId)
    if (input.type) query = query.where('type', '==', input.type)
    else if (!input.accountId && !input.memberId && !input.categoryId)
      query = query.where('type', 'in', ['EXPENSE', 'INCOME'])
    const searchToken = input.search ? normalizeSearchText(input.search).split(' ')[0] : undefined
    if (searchToken) query = query.where('searchPrefixes', 'array-contains', searchToken)

    // Stream only the fields needed for totals, without the list's page limit or cursor.
    const currencies = new Map<string, TransactionTotals['byCurrency'][number]>()
    let transactionCount = 0
    const snapshots = query
      .select('type', 'currency', 'amountMinor')
      .stream() as unknown as AsyncIterable<QueryDocumentSnapshot>
    for await (const snapshot of snapshots) {
      const value = snapshot.data() as Pick<Transaction, 'type' | 'currency' | 'amountMinor'>
      if (value.type !== 'EXPENSE' && value.type !== 'INCOME') continue
      const total = currencies.get(value.currency) ?? {
        currency: value.currency,
        incomeMinor: 0,
        expenseMinor: 0,
        netMinor: 0,
      }
      if (value.type === 'INCOME')
        total.incomeMinor = addMinor(total.incomeMinor, value.amountMinor)
      else total.expenseMinor = addMinor(total.expenseMinor, value.amountMinor)
      total.netMinor = total.incomeMinor - total.expenseMinor
      currencies.set(value.currency, total)
      transactionCount++
    }
    return {
      transactionCount,
      byCurrency: [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    }
  },
  true,
  { timeoutSeconds: 120 },
)
