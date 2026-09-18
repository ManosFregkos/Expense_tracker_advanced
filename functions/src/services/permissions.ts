import { HttpsError } from 'firebase-functions/v2/https'
import type { HouseholdMember, HouseholdRole } from '@family-expense-tracker/shared'
import { db } from '../firebase.js'

export async function requireMember(
  householdId: string,
  userId: string,
  roles?: readonly HouseholdRole[],
): Promise<HouseholdMember> {
  const snapshot = await db.doc(`households/${householdId}/members/${userId}`).get()
  if (!snapshot.exists) throw new HttpsError('permission-denied', 'Household access denied.')
  const member = snapshot.data() as HouseholdMember
  if (roles && !roles.includes(member.role)) {
    throw new HttpsError('permission-denied', 'Your household role cannot perform this action.')
  }
  return member
}
