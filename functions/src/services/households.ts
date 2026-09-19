import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import {
  DEFAULT_CATEGORY_SEEDS,
  createHouseholdSchema,
  deleteHouseholdSchema,
  updateHouseholdSchema,
  type Household,
  normalizeSearchText,
} from '@family-expense-tracker/shared'
import { HttpsError } from 'firebase-functions/v2/https'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { writeAudit } from './audit.js'
import { requireMember } from './permissions.js'

export const createHousehold = secureCallable(createHouseholdSchema, async (input, actor) => {
  const householdRef = db.collection('households').doc()
  const memberRef = householdRef.collection('members').doc(actor.uid)
  const userRef = db.doc(`users/${actor.uid}`)
  await db.runTransaction(async (transaction) => {
    const now = Timestamp.now()
    transaction.set(householdRef, {
      id: householdRef.id,
      name: input.name,
      defaultCurrency: input.defaultCurrency,
      timeZone: input.timeZone,
      createdBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    })
    transaction.set(memberRef, {
      userId: actor.uid,
      householdId: householdRef.id,
      displayName: input.displayName,
      role: 'OWNER',
      joinedAt: now,
    })
    transaction.set(
      userRef,
      {
        id: actor.uid,
        email: actor.email,
        displayName: input.displayName,
        updatedAt: now,
        createdAt: now,
        householdIds: FieldValue.arrayUnion(householdRef.id),
      },
      { merge: true },
    )
    for (const seed of DEFAULT_CATEGORY_SEEDS) {
      transaction.set(householdRef.collection('categories').doc(seed.id), {
        id: seed.id,
        householdId: householdRef.id,
        name: seed.name,
        normalizedName: normalizeSearchText(seed.name),
        type: seed.type,
        ...(seed.parentId ? { parentCategoryId: seed.parentId } : {}),
        ...(seed.icon ? { icon: seed.icon } : {}),
        isSystem: true,
        origin: 'SYSTEM',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      })
    }
    const auditRef = householdRef.collection('auditLogs').doc()
    transaction.set(auditRef, {
      id: auditRef.id,
      householdId: householdRef.id,
      userId: actor.uid,
      action: 'MEMBER_ROLE_CHANGE',
      entityType: 'HOUSEHOLD_MEMBER',
      entityId: actor.uid,
      timestamp: FieldValue.serverTimestamp(),
      changes: { after: { role: 'OWNER' } },
    })
  })
  return { householdId: householdRef.id }
})

export const updateHousehold = secureCallable(updateHouseholdSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
  const ref = db.doc(`households/${input.householdId}`)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Household not found.')
    const update = {
      name: input.name,
      defaultCurrency: input.defaultCurrency,
      timeZone: input.timeZone,
      updatedAt: Timestamp.now(),
    }
    transaction.update(ref, update)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'UPDATE_HOUSEHOLD',
      entityType: 'HOUSEHOLD_SETTINGS',
      entityId: input.householdId,
      before: snapshot.data() as Record<string, unknown>,
      after: update,
    })
  })
  return { householdId: input.householdId }
})

export const deleteHousehold = secureCallable(deleteHouseholdSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid, ['OWNER'])
  const ref = db.doc(`households/${input.householdId}`)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'Household not found.')
  const household = snapshot.data() as Household
  if (input.confirmationName !== household.name)
    throw new HttpsError('invalid-argument', 'Household name confirmation does not match.')
  const members = await ref.collection('members').get()
  const cleanup = db.batch()
  for (const member of members.docs)
    cleanup.set(
      db.doc(`users/${member.id}`),
      { householdIds: FieldValue.arrayRemove(input.householdId), updatedAt: Timestamp.now() },
      { merge: true },
    )
  await cleanup.commit()
  await db.recursiveDelete(ref)
  return { householdId: input.householdId }
})
