import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  archiveAccountSchema,
  createAccountSchema,
  updateAccountSchema,
  type Household,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { writeAudit } from './audit.js'
import { requireMember } from './permissions.js'

export const createAccount = secureCallable(createAccountSchema, async (input, actor) => {
  await Promise.all([
    requireMember(input.householdId, actor.uid),
    requireMember(input.householdId, input.ownerUserId),
  ])
  const householdSnapshot = await db.doc(`households/${input.householdId}`).get()
  const household = householdSnapshot.data() as Household | undefined
  if (!household || input.currency !== household.defaultCurrency) {
    throw new HttpsError(
      'failed-precondition',
      'V1 accounts must use the household reporting currency.',
    )
  }
  const ref = db.collection(`households/${input.householdId}/accounts`).doc()
  await db.runTransaction(async (transaction) => {
    const now = Timestamp.now()
    const account = {
      id: ref.id,
      householdId: input.householdId,
      ownerUserId: input.ownerUserId,
      name: input.name,
      type: input.type,
      ...(input.institution ? { institution: input.institution } : {}),
      currency: input.currency,
      openingBalanceMinor: input.openingBalanceMinor,
      currentBalanceMinor: input.openingBalanceMinor,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }
    transaction.set(ref, account)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'CREATE_ACCOUNT',
      entityType: 'ACCOUNT',
      entityId: ref.id,
      after: account,
    })
  })
  return { accountId: ref.id }
})

export const updateAccount = secureCallable(updateAccountSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.doc(`households/${input.householdId}/accounts/${input.accountId}`)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Account not found.')
    const update = {
      name: input.name,
      ...(input.institution ? { institution: input.institution } : {}),
      updatedAt: Timestamp.now(),
    }
    transaction.update(ref, update)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'UPDATE_ACCOUNT',
      entityType: 'ACCOUNT',
      entityId: input.accountId,
      before: snapshot.data() as Record<string, unknown>,
      after: update,
    })
  })
  return { accountId: input.accountId }
})

export const archiveAccount = secureCallable(archiveAccountSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.doc(`households/${input.householdId}/accounts/${input.accountId}`)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Account not found.')
    transaction.update(ref, { isArchived: true, updatedAt: FieldValue.serverTimestamp() })
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'ARCHIVE_ACCOUNT',
      entityType: 'ACCOUNT',
      entityId: input.accountId,
      before: snapshot.data() as Record<string, unknown>,
      after: { isArchived: true },
    })
  })
  return { accountId: input.accountId }
})
