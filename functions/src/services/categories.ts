import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  createCategorySchema,
  normalizeSearchText,
  updateCategorySchema,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { writeAudit } from './audit.js'
import { requireMember } from './permissions.js'

export const createCategory = secureCallable(createCategorySchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const normalizedName = normalizeSearchText(input.name)
  const ref = db.collection(`households/${input.householdId}/categories`).doc()
  const category = {
    id: ref.id,
    householdId: input.householdId,
    name: input.name,
    normalizedName,
    type: input.type,
    ...(input.parentCategoryId ? { parentCategoryId: input.parentCategoryId } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.color ? { color: input.color } : {}),
    origin: 'CUSTOM',
    createdBy: actor.uid,
    isSystem: false,
    isArchived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
  await db.runTransaction(async (transaction) => {
    const categories = await transaction.get(
      db.collection(`households/${input.householdId}/categories`),
    )
    const parent = input.parentCategoryId
      ? categories.docs.find((doc) => doc.id === input.parentCategoryId)
      : undefined
    if (
      input.parentCategoryId &&
      (!parent || parent.get('type') !== input.type || parent.get('parentCategoryId'))
    )
      throw new HttpsError(
        'failed-precondition',
        'Parent must be a top-level category of the same type.',
      )
    const duplicate = categories.docs.some(
      (doc) =>
        doc.get('type') === input.type &&
        (doc.get('parentCategoryId') ?? null) === (input.parentCategoryId ?? null) &&
        (doc.get('normalizedName') ?? normalizeSearchText(String(doc.get('name')))) ===
          normalizedName,
    )
    if (duplicate)
      throw new HttpsError(
        'already-exists',
        'A category with this name already exists at this level.',
      )
    transaction.set(ref, category)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'CATEGORY_CREATED',
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
    const existing = snapshot.data() as Record<string, unknown>
    if (existing.isSystem)
      throw new HttpsError('failed-precondition', 'System categories cannot be changed.')
    const normalizedName = normalizeSearchText(input.name)
    const [categories, directlyReferenced, splitReferenced] = await Promise.all([
      transaction.get(db.collection(`households/${input.householdId}/categories`)),
      transaction.get(
        db
          .collection(`households/${input.householdId}/transactions`)
          .where('categoryId', '==', input.categoryId)
          .limit(1),
      ),
      transaction.get(
        db
          .collection(`households/${input.householdId}/transactions`)
          .where('splitCategoryIds', 'array-contains', input.categoryId)
          .limit(1),
      ),
    ])
    if (input.parentCategoryId === input.categoryId)
      throw new HttpsError('failed-precondition', 'A category cannot be its own parent.')
    const parent = input.parentCategoryId
      ? categories.docs.find((doc) => doc.id === input.parentCategoryId)
      : undefined
    if (
      input.parentCategoryId &&
      (!parent || parent.get('type') !== input.type || parent.get('parentCategoryId'))
    )
      throw new HttpsError(
        'failed-precondition',
        'Parent must be a top-level category of the same type.',
      )
    const hasChildren = categories.docs.some(
      (doc) => doc.get('parentCategoryId') === input.categoryId,
    )
    if (input.parentCategoryId && hasChildren)
      throw new HttpsError(
        'failed-precondition',
        'A parent category with children cannot become a subcategory.',
      )
    if (
      input.isArchived &&
      categories.docs.some(
        (doc) => doc.get('parentCategoryId') === input.categoryId && !doc.get('isArchived'),
      )
    )
      throw new HttpsError(
        'failed-precondition',
        'Archive active subcategories before archiving their parent.',
      )
    if ((!directlyReferenced.empty || !splitReferenced.empty) && input.type !== existing.type)
      throw new HttpsError('failed-precondition', 'A referenced category cannot change type.')
    const duplicate = categories.docs.some(
      (doc) =>
        doc.id !== input.categoryId &&
        doc.get('type') === input.type &&
        (doc.get('parentCategoryId') ?? null) === (input.parentCategoryId ?? null) &&
        (doc.get('normalizedName') ?? normalizeSearchText(String(doc.get('name')))) ===
          normalizedName,
    )
    if (duplicate)
      throw new HttpsError(
        'already-exists',
        'A category with this name already exists at this level.',
      )
    const update = {
      name: input.name,
      normalizedName,
      type: input.type,
      ...(input.parentCategoryId
        ? { parentCategoryId: input.parentCategoryId }
        : { parentCategoryId: null }),
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
      ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
      updatedAt: Timestamp.now(),
    }
    transaction.update(ref, update)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: input.isArchived ? 'CATEGORY_ARCHIVED' : 'CATEGORY_UPDATED',
      entityType: 'CATEGORY',
      entityId: ref.id,
      before: snapshot.data() as Record<string, unknown>,
      after: update,
    })
  })
  return { categoryId: ref.id }
})
