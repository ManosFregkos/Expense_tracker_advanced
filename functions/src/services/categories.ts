import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { createCategorySchema, updateCategorySchema } from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { writeAudit } from './audit.js'
import { requireMember } from './permissions.js'

export const createCategory = secureCallable(createCategorySchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  if (input.parentCategoryId) {
    const parent = await db
      .doc(`households/${input.householdId}/categories/${input.parentCategoryId}`)
      .get()
    if (!parent.exists || parent.get('type') !== input.type)
      throw new HttpsError('failed-precondition', 'Invalid parent category.')
  }
  const ref = db.collection(`households/${input.householdId}/categories`).doc()
  const category = {
    id: ref.id,
    householdId: input.householdId,
    name: input.name,
    type: input.type,
    ...(input.parentCategoryId ? { parentCategoryId: input.parentCategoryId } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    isSystem: false,
    isArchived: false,
  }
  await db.runTransaction(async (transaction) => {
    transaction.set(ref, category)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'CREATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: ref.id,
      after: category,
    })
  })
  return { categoryId: ref.id }
})

export const updateCategory = secureCallable(updateCategorySchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.doc(`households/${input.householdId}/categories/${input.categoryId}`)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Category not found.')
    const update = {
      name: input.name,
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
      updatedAt: Timestamp.now(),
    }
    transaction.update(ref, update)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'UPDATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: ref.id,
      before: snapshot.data() as Record<string, unknown>,
      after: update,
    })
  })
  return { categoryId: ref.id }
})
