import { Timestamp } from 'firebase-admin/firestore'
import {
  deleteMerchantRuleSchema,
  merchantRuleSchema,
  normalizeSearchText,
  updateMerchantRuleSchema,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { requireMember } from './permissions.js'
import { HttpsError } from 'firebase-functions/v2/https'
import { writeAudit } from './audit.js'

async function validateCategory(householdId: string, categoryId: string): Promise<void> {
  const category = await db.doc(`households/${householdId}/categories/${categoryId}`).get()
  if (!category.exists || category.get('type') !== 'EXPENSE' || category.get('isArchived'))
    throw new HttpsError(
      'failed-precondition',
      'Merchant rules require an active expense category in this household.',
    )
}

export const createMerchantRule = secureCallable(merchantRuleSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  await validateCategory(input.householdId, input.categoryId)
  const ref = db.collection(`households/${input.householdId}/merchantRules`).doc()
  await db.runTransaction(async (transaction) => {
    const now = Timestamp.now()
    const rule = {
      id: ref.id,
      ...input,
      normalizedPattern: normalizeSearchText(input.pattern),
      enabled: true,
      createdBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    }
    transaction.set(ref, rule)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'MERCHANT_RULE_CREATED',
      entityType: 'MERCHANT_RULE',
      entityId: ref.id,
      after: rule,
    })
  })
  return { merchantRuleId: ref.id }
})

export const updateMerchantRule = secureCallable(updateMerchantRuleSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  await validateCategory(input.householdId, input.categoryId)
  const ref = db.doc(`households/${input.householdId}/merchantRules/${input.merchantRuleId}`)
  await db.runTransaction(async (transaction) => {
    const before = await transaction.get(ref)
    if (!before.exists) throw new HttpsError('not-found', 'Merchant rule not found.')
    const update = {
      pattern: input.pattern,
      normalizedPattern: normalizeSearchText(input.pattern),
      matcherType: input.matcherType,
      categoryId: input.categoryId,
      priority: input.priority,
      enabled: input.enabled,
      updatedAt: Timestamp.now(),
    }
    transaction.update(ref, update)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'MERCHANT_RULE_UPDATED',
      entityType: 'MERCHANT_RULE',
      entityId: ref.id,
      before: before.data() as Record<string, unknown>,
      after: update,
    })
  })
  return { merchantRuleId: ref.id }
})

export const deleteMerchantRule = secureCallable(deleteMerchantRuleSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.doc(`households/${input.householdId}/merchantRules/${input.merchantRuleId}`)
  await db.runTransaction(async (transaction) => {
    const before = await transaction.get(ref)
    if (!before.exists) return
    transaction.delete(ref)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'MERCHANT_RULE_DELETED',
      entityType: 'MERCHANT_RULE',
      entityId: ref.id,
      before: before.data() as Record<string, unknown>,
    })
  })
  return { merchantRuleId: ref.id }
})
