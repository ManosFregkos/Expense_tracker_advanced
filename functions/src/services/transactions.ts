import {
  FieldValue,
  Timestamp,
  type Transaction as FirestoreTransaction,
} from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  accountEffects,
  buildSearchPrefixes,
  mergeAnalyticsDeltas,
  monthKey,
  transactionAnalyticsDelta,
  transactionIdSchema,
  transactionInputSchema,
  updateTransactionSchema,
  type FinancialAccount,
  type Household,
  type Transaction,
  type TransactionInput,
} from '@family-expense-tracker/shared'
import { secureCallable, type Actor } from '../callable.js'
import { db } from '../firebase.js'
import { safeFinancialSnapshot, writeAudit } from './audit.js'
import { applyDelta } from './analytics.js'
import { requireMember } from './permissions.js'

function timestampToDate(value: Transaction['transactionDate']): Date {
  return value instanceof Date ? value : value.toDate()
}

function inputToTransaction(input: TransactionInput, id: string, actor: Actor): Transaction {
  const now = Timestamp.now()
  const common = {
    id,
    householdId: input.householdId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    description: input.description,
    ...(input.merchant ? { merchant: input.merchant } : {}),
    transactionDate: Timestamp.fromDate(new Date(input.transactionDate)),
    ...(input.notes ? { notes: input.notes } : {}),
    source: input.source,
    ...(input.bankTransactionId ? { bankTransactionId: input.bankTransactionId } : {}),
    createdBy: actor.uid,
    searchPrefixes: buildSearchPrefixes(input.description, input.merchant),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }
  if (input.type === 'TRANSFER') {
    return {
      ...common,
      type: 'TRANSFER',
      transfer: {
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
      },
    }
  }
  return {
    ...common,
    type: input.type,
    accountId: input.accountId,
    ownerUserId: input.ownerUserId,
    categoryId: input.categoryId,
  }
}

function updatedTransaction(
  existing: Transaction,
  input: TransactionInput,
  actor: Actor,
): Transaction {
  const replacement = inputToTransaction(input, existing.id, actor)
  return {
    ...replacement,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: Timestamp.now(),
    ...(existing.deletedAt ? { deletedAt: existing.deletedAt } : {}),
    ...(existing.deletedBy ? { deletedBy: existing.deletedBy } : {}),
  }
}

function involvedAccountIds(transaction: Transaction): string[] {
  return transaction.type === 'TRANSFER'
    ? [transaction.transfer.sourceAccountId, transaction.transfer.destinationAccountId]
    : [transaction.accountId]
}

async function loadHousehold(
  transaction: FirestoreTransaction,
  householdId: string,
): Promise<Household> {
  const snapshot = await transaction.get(db.doc(`households/${householdId}`))
  if (!snapshot.exists) throw new HttpsError('not-found', 'Household not found.')
  return snapshot.data() as Household
}

async function validateTransactionRelations(
  transaction: FirestoreTransaction,
  financialTransaction: Transaction,
): Promise<Map<string, FinancialAccount>> {
  const ids = [...new Set(involvedAccountIds(financialTransaction))]
  const accountSnapshots = await Promise.all(
    ids.map((id) =>
      transaction.get(db.doc(`households/${financialTransaction.householdId}/accounts/${id}`)),
    ),
  )
  const accounts = new Map<string, FinancialAccount>()
  for (const snapshot of accountSnapshots) {
    if (!snapshot.exists)
      throw new HttpsError('failed-precondition', 'A selected account no longer exists.')
    const account = snapshot.data() as FinancialAccount
    if (account.isArchived)
      throw new HttpsError(
        'failed-precondition',
        'Archived accounts cannot receive new transactions.',
      )
    if (account.currency !== financialTransaction.currency) {
      throw new HttpsError('failed-precondition', 'Cross-currency transactions are not supported.')
    }
    accounts.set(account.id, account)
  }
  if (financialTransaction.type !== 'TRANSFER') {
    const account = accounts.get(financialTransaction.accountId)
    if (account?.ownerUserId !== financialTransaction.ownerUserId) {
      throw new HttpsError('failed-precondition', 'The payer must own the selected account.')
    }
    const [owner, category] = await Promise.all([
      transaction.get(
        db.doc(
          `households/${financialTransaction.householdId}/members/${financialTransaction.ownerUserId}`,
        ),
      ),
      transaction.get(
        db.doc(
          `households/${financialTransaction.householdId}/categories/${financialTransaction.categoryId}`,
        ),
      ),
    ])
    if (!owner.exists)
      throw new HttpsError('failed-precondition', 'Account owner is not a household member.')
    if (
      !category.exists ||
      category.get('type') !== financialTransaction.type ||
      category.get('isArchived') === true
    ) {
      throw new HttpsError(
        'failed-precondition',
        'Select an active category matching the transaction type.',
      )
    }
  }
  return accounts
}

function combineAccountEffects(
  before: Transaction | undefined,
  after: Transaction | undefined,
): Record<string, number> {
  const combined: Record<string, number> = {}
  const add = (effects: Record<string, number>) => {
    for (const [id, amount] of Object.entries(effects)) combined[id] = (combined[id] ?? 0) + amount
  }
  if (before) add(accountEffects(before, -1))
  if (after) add(accountEffects(after))
  return combined
}

async function applyFinancialMutation(
  firestoreTransaction: FirestoreTransaction,
  household: Household,
  before: Transaction | undefined,
  after: Transaction | undefined,
): Promise<void> {
  const accountDeltas = combineAccountEffects(before, after)
  const accountRefs = Object.keys(accountDeltas).map((id) =>
    db.doc(`households/${household.id}/accounts/${id}`),
  )
  const accountSnapshots = await Promise.all(
    accountRefs.map((ref) => firestoreTransaction.get(ref)),
  )

  const monthDeltas = new Map<string, ReturnType<typeof transactionAnalyticsDelta>>()
  for (const [value, direction] of [
    [before, -1],
    [after, 1],
  ] as const) {
    if (!value) continue
    const key = monthKey(timestampToDate(value.transactionDate), household.timeZone)
    monthDeltas.set(
      key,
      mergeAnalyticsDeltas(
        monthDeltas.get(key) ?? {
          incomeMinor: 0,
          expenseMinor: 0,
          transactionCount: 0,
          byCategory: {},
          byMember: {},
          byAccount: {},
          byMerchant: {},
        },
        transactionAnalyticsDelta(value, direction),
      ),
    )
  }
  const analyticsRefs = [...monthDeltas.keys()].map((key) =>
    db.doc(`households/${household.id}/monthlyAnalytics/${key}`),
  )
  const analyticsSnapshots = await Promise.all(
    analyticsRefs.map((ref) => firestoreTransaction.get(ref)),
  )

  accountSnapshots.forEach((snapshot, index) => {
    const ref = accountRefs[index]
    if (!ref || !snapshot.exists)
      throw new HttpsError('failed-precondition', 'A referenced account no longer exists.')
    const delta = accountDeltas[ref.id] ?? 0
    firestoreTransaction.update(ref, {
      currentBalanceMinor: FieldValue.increment(delta),
      updatedAt: Timestamp.now(),
    })
  })
  analyticsSnapshots.forEach((snapshot, index) => {
    const ref = analyticsRefs[index]
    const delta = ref ? monthDeltas.get(ref.id) : undefined
    if (ref && delta)
      firestoreTransaction.set(
        ref,
        applyDelta(snapshot.data(), ref.id, household.defaultCurrency, delta),
      )
  })
}

export const createTransaction = secureCallable(transactionInputSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.collection(`households/${input.householdId}/transactions`).doc()
  const financialTransaction = inputToTransaction(input, ref.id, actor)
  await db.runTransaction(async (transaction) => {
    const household = await loadHousehold(transaction, input.householdId)
    await validateTransactionRelations(transaction, financialTransaction)
    await applyFinancialMutation(transaction, household, undefined, financialTransaction)
    transaction.set(ref, financialTransaction)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'CREATE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: ref.id,
      after: safeFinancialSnapshot(financialTransaction as unknown as Record<string, unknown>),
    })
  })
  return { transactionId: ref.id }
})

export const createTransfer = createTransaction

export const updateTransaction = secureCallable(updateTransactionSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.doc(`households/${input.householdId}/transactions/${input.transactionId}`)
  await db.runTransaction(async (transaction) => {
    const [household, snapshot] = await Promise.all([
      loadHousehold(transaction, input.householdId),
      transaction.get(ref),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Transaction not found.')
    const before = snapshot.data() as Transaction
    if (before.deletedAt)
      throw new HttpsError('failed-precondition', 'Restore the transaction before editing it.')
    const after = updatedTransaction(
      before,
      { ...input.transaction, householdId: input.householdId },
      actor,
    )
    await validateTransactionRelations(transaction, after)
    await applyFinancialMutation(transaction, household, before, after)
    transaction.set(ref, after)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'UPDATE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: ref.id,
      before: safeFinancialSnapshot(before as unknown as Record<string, unknown>),
      after: safeFinancialSnapshot(after as unknown as Record<string, unknown>),
    })
  })
  return { transactionId: ref.id }
})

async function setDeletionState(
  input: { householdId: string; transactionId: string },
  actor: Actor,
  restore: boolean,
): Promise<{ transactionId: string }> {
  await requireMember(input.householdId, actor.uid)
  const ref = db.doc(`households/${input.householdId}/transactions/${input.transactionId}`)
  await db.runTransaction(async (transaction) => {
    const [household, snapshot] = await Promise.all([
      loadHousehold(transaction, input.householdId),
      transaction.get(ref),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Transaction not found.')
    const before = snapshot.data() as Transaction
    if (restore === !before.deletedAt) return
    const restored = { ...before, isDeleted: false, updatedAt: Timestamp.now() }
    delete restored.deletedAt
    delete restored.deletedBy
    const after: Transaction = restore
      ? restored
      : {
          ...before,
          isDeleted: true,
          deletedAt: Timestamp.now(),
          deletedBy: actor.uid,
          updatedAt: Timestamp.now(),
        }
    await applyFinancialMutation(transaction, household, before, after)
    transaction.set(ref, after)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: restore ? 'RESTORE_TRANSACTION' : 'DELETE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: ref.id,
      before: safeFinancialSnapshot(before as unknown as Record<string, unknown>),
      after: safeFinancialSnapshot(after as unknown as Record<string, unknown>),
    })
  })
  return { transactionId: input.transactionId }
}

export const deleteTransaction = secureCallable(transactionIdSchema, (input, actor) =>
  setDeletionState(input, actor, false),
)
export const restoreTransaction = secureCallable(transactionIdSchema, (input, actor) =>
  setDeletionState(input, actor, true),
)

export const internalTransactionHelpers = { inputToTransaction, combineAccountEffects }
