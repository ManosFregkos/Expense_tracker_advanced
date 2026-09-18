import { Timestamp } from 'firebase-admin/firestore'
import { merchantRuleSchema } from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { requireMember } from './permissions.js'

export const createMerchantRule = secureCallable(merchantRuleSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = db.collection(`households/${input.householdId}/merchantRules`).doc()
  await ref.set({ id: ref.id, ...input, createdBy: actor.uid, createdAt: Timestamp.now() })
  return { merchantRuleId: ref.id }
})
