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
  transactionEffectForAccount,
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
    ...(input.tags?.length
      ? { tags: [...new Set(input.tags.map((tag) => tag.trim().toLowerCase()))] }
      : {}),
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
    ...(input.type === 'EXPENSE' && input.splits?.length
      ? {
          splits: input.splits,
          splitCategoryIds: [...new Set(input.splits.map((split) => split.categoryId))],
        }
      : {}),
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
    source: existing.source,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: Timestamp.now(),
    ...(existing.bankTransactionId ? { bankTransactionId: existing.bankTransactionId } : {}),
    ...(existing.bankTransactionIds ? { bankTransactionIds: existing.bankTransactionIds } : {}),
    ...(existing.bankStatus ? { bankStatus: existing.bankStatus } : {}),
    ...(existing.affectsBalance === false ? { affectsBalance: false } : {}),
    ...(existing.excludeFromAnalytics ? { excludeFromAnalytics: true } : {}),
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
    if (financialTransaction.type === 'EXPENSE' && financialTransaction.splits?.length) {
      const splitCategories = await Promise.all(
        financialTransaction.splits.map((split) =>
          transaction.get(
            db.doc(`households/${financialTransaction.householdId}/categories/${split.categoryId}`),
          ),
        ),
      )
      if (
        splitCategories.some(
          (splitCategory) =>
            !splitCategory.exists ||
            splitCategory.get('type') !== 'EXPENSE' ||
            splitCategory.get('isArchived'),
        )
      )
        throw new HttpsError(
          'failed-precondition',
          'Every split must use an active expense category in this household.',
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
  const affectedIds = [
    ...new Set([
      ...(before ? involvedAccountIds(before) : []),
      ...(after ? involvedAccountIds(after) : []),
    ]),
  ]
  const accountRefs = affectedIds.map((id) => db.doc(`households/${household.id}/accounts/${id}`))
  const accountSnapshots = await Promise.all(
    accountRefs.map((ref) => firestoreTransaction.get(ref)),
  )
  const accountDeltas: Record<string, number> = {}
  accountSnapshots.forEach((snapshot) => {
    if (!snapshot.exists)
      throw new HttpsError('failed-precondition', 'A referenced account no longer exists.')
    const account = snapshot.data() as FinancialAccount
    accountDeltas[account.id] =
      (before ? -transactionEffectForAccount(before, account.id, account.type) : 0) +
      (after ? transactionEffectForAccount(after, account.id, account.type) : 0)
  })

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
          byTag: {},
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
    const existingAppBalance = snapshot.get('appCalculatedBalanceMinor') as number | undefined
    firestoreTransaction.update(ref, {
      currentBalanceMinor: FieldValue.increment(delta),
      appCalculatedBalanceMinor:
        existingAppBalance === undefined
          ? Number(snapshot.get('currentBalanceMinor') ?? 0) + delta
          : FieldValue.increment(delta),
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
    if (financialTransaction.type === 'EXPENSE' && financialTransaction.splits?.length)
      writeAudit(db, transaction, {
        householdId: input.householdId,
        userId: actor.uid,
        action: 'TRANSACTION_SPLIT_CREATED',
        entityType: 'TRANSACTION',
        entityId: ref.id,
        after: {
          splitCount: financialTransaction.splits.length,
          amountMinor: financialTransaction.amountMinor,
        },
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
    if (before.bankTransactionId) {
      const immutableChanged =
        input.transaction.type !== before.type ||
        input.transaction.amountMinor !== before.amountMinor ||
        input.transaction.currency !== before.currency ||
        input.transaction.transactionDate !==
          timestampToDate(before.transactionDate).toISOString() ||
        (before.type !== 'TRANSFER' &&
          input.transaction.type !== 'TRANSFER' &&
          input.transaction.accountId !== before.accountId) ||
        (before.type === 'TRANSFER' &&
          input.transaction.type === 'TRANSFER' &&
          (input.transaction.sourceAccountId !== before.transfer.sourceAccountId ||
            input.transaction.destinationAccountId !== before.transfer.destinationAccountId))
      if (immutableChanged)
        throw new HttpsError(
          'failed-precondition',
          'Unlink this bank transaction before changing its amount, date, account, currency, or type.',
        )
    }
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
    if (
      after.type === 'EXPENSE' &&
      after.splits?.length &&
      (before.type !== 'EXPENSE' || JSON.stringify(before.splits) !== JSON.stringify(after.splits))
    )
      writeAudit(db, transaction, {
        householdId: input.householdId,
        userId: actor.uid,
        action: 'TRANSACTION_SPLIT_CREATED',
        entityType: 'TRANSACTION',
        entityId: ref.id,
        after: { splitCount: after.splits.length, amountMinor: after.amountMinor },
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
    if (!restore && before.bankTransactionId && before.source !== 'BANK_SYNC')
      throw new HttpsError(
        'failed-precondition',
        'Unlink this bank transaction before deleting it.',
      )
    if (
      restore &&
      before.bankTransactionId &&
      (before.bankStatus === 'REVERSED' || before.bankStatus === 'CANCELLED')
    )
      throw new HttpsError(
        'failed-precondition',
        'A reversed or cancelled bank transaction cannot be restored.',
      )
    const bankRefs = (
      before.bankTransactionIds ?? (before.bankTransactionId ? [before.bankTransactionId] : [])
    ).map((id) => db.doc(`households/${input.householdId}/bankTransactions/${id}`))
    const bankSnapshots = await Promise.all(bankRefs.map((bankRef) => transaction.get(bankRef)))
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
    if (!restore && before.source === 'BANK_SYNC')
      bankSnapshots.forEach((bankSnapshot, index) => {
        const bankRef = bankRefs[index]
        if (bankSnapshot.exists && bankRef)
          transaction.update(bankRef, {
            reconciliationStatus: 'IGNORED',
            updatedAt: Timestamp.now(),
          })
      })
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

export const unlinkBankTransaction = secureCallable(transactionIdSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.doc(`households/${input.householdId}/transactions/${input.transactionId}`)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Transaction not found.')
    const financial = snapshot.data() as Transaction
    if (!financial.bankTransactionId) return
    if (financial.source === 'BANK_SYNC')
      throw new HttpsError(
        'failed-precondition',
        'Imported transactions cannot be unlinked. Delete it to preserve an ignored bank record.',
      )
    const bankRefs = (financial.bankTransactionIds ?? [financial.bankTransactionId]).map((id) =>
      db.doc(`households/${input.householdId}/bankTransactions/${id}`),
    )
    const bankSnapshots = await Promise.all(bankRefs.map((bankRef) => transaction.get(bankRef)))
    transaction.update(ref, {
      bankTransactionId: FieldValue.delete(),
      bankTransactionIds: FieldValue.delete(),
      bankStatus: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    })
    bankSnapshots.forEach((bank, index) => {
      const bankRef = bankRefs[index]
      if (bank.exists && bankRef)
        transaction.update(bankRef, {
          normalizedTransactionId: FieldValue.delete(),
          reconciliationStatus: 'REVIEW',
          reviewReason: 'POSSIBLE_DUPLICATE',
          updatedAt: Timestamp.now(),
        })
    })
  })
  return { transactionId: input.transactionId }
})

export const internalTransactionHelpers = { inputToTransaction, combineAccountEffects }

export async function createImportedTransaction(
  financialTransaction: Transaction,
): Promise<string> {
  const ref = db.doc(
    `households/${financialTransaction.householdId}/transactions/${financialTransaction.id}`,
  )
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists) return
    const household = await loadHousehold(transaction, financialTransaction.householdId)
    await validateTransactionRelations(transaction, financialTransaction)
    await applyFinancialMutation(transaction, household, undefined, financialTransaction)
    transaction.set(ref, financialTransaction)
  })
  return ref.id
}

export async function reverseImportedTransaction(
  householdId: string,
  transactionId: string,
): Promise<void> {
  const ref = db.doc(`households/${householdId}/transactions/${transactionId}`)
  await db.runTransaction(async (transaction) => {
    const [household, snapshot] = await Promise.all([
      loadHousehold(transaction, householdId),
      transaction.get(ref),
    ])
    if (!snapshot.exists) return
    const before = snapshot.data() as Transaction
    if (before.isDeleted) return
    const after: Transaction = {
      ...before,
      bankStatus: 'REVERSED',
      isDeleted: true,
      deletedAt: Timestamp.now(),
      deletedBy: 'OPEN_BANKING_SYNC',
      updatedAt: Timestamp.now(),
    }
    await applyFinancialMutation(transaction, household, before, after)
    transaction.set(ref, after)
  })
}

export async function updateImportedTransactionFromBank(
  householdId: string,
  transactionId: string,
  update: {
    amountMinor: number
    transactionDate: Timestamp
    description: string
    merchant?: string
    bankStatus: 'BOOKED' | 'PENDING'
  },
): Promise<void> {
  const ref = db.doc(`households/${householdId}/transactions/${transactionId}`)
  await db.runTransaction(async (transaction) => {
    const [household, snapshot] = await Promise.all([
      loadHousehold(transaction, householdId),
      transaction.get(ref),
    ])
    if (!snapshot.exists) return
    const before = snapshot.data() as Transaction
    if (before.source !== 'BANK_SYNC' || before.isDeleted) return
    const after: Transaction = {
      ...before,
      amountMinor: update.amountMinor,
      transactionDate: update.transactionDate,
      description: update.description,
      ...(update.merchant ? { merchant: update.merchant } : {}),
      bankStatus: update.bankStatus,
      searchPrefixes: buildSearchPrefixes(update.description, update.merchant),
      updatedAt: Timestamp.now(),
    }
    await applyFinancialMutation(transaction, household, before, after)
    transaction.set(ref, after)
  })
}
