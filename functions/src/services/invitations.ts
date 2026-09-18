import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  createInvitationSchema,
  invitationIdSchema,
  type Household,
  type Invitation,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { writeAudit } from './audit.js'
import { requireMember } from './permissions.js'

const INVITATION_DAYS = 7

export const createInvitation = secureCallable(createInvitationSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
  const householdSnapshot = await db.doc(`households/${input.householdId}`).get()
  if (!householdSnapshot.exists) throw new HttpsError('not-found', 'Household not found.')
  const existing = await db
    .collection('invitations')
    .where('householdId', '==', input.householdId)
    .where('emailLower', '==', input.email)
    .where('status', '==', 'PENDING')
    .limit(1)
    .get()
  if (!existing.empty)
    throw new HttpsError('already-exists', 'A pending invitation already exists for this email.')
  const household = householdSnapshot.data() as Household
  const ref = db.collection('invitations').doc()
  const now = Timestamp.now()
  const invitation = {
    id: ref.id,
    householdId: input.householdId,
    householdName: household.name,
    email: input.email,
    emailLower: input.email,
    role: input.role,
    invitedBy: actor.uid,
    status: 'PENDING',
    createdAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + INVITATION_DAYS * 86_400_000),
  }
  await db.runTransaction(async (transaction) => {
    transaction.set(ref, invitation)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'CREATE_INVITATION',
      entityType: 'INVITATION',
      entityId: ref.id,
      after: { email: input.email, role: input.role, status: 'PENDING' },
    })
  })
  return { invitationId: ref.id }
})

export const acceptInvitation = secureCallable(invitationIdSchema, async (input, actor) => {
  const ref = db.doc(`invitations/${input.invitationId}`)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Invitation not found.')
    const invitation = snapshot.data() as Invitation
    if (invitation.emailLower !== actor.email.toLowerCase())
      throw new HttpsError('permission-denied', 'This invitation belongs to another email.')
    if (invitation.status !== 'PENDING')
      throw new HttpsError('failed-precondition', 'Invitation is no longer pending.')
    const expiresAt =
      invitation.expiresAt instanceof Date ? invitation.expiresAt : invitation.expiresAt.toDate()
    if (expiresAt.getTime() <= Date.now()) {
      throw new HttpsError('deadline-exceeded', 'Invitation has expired.')
    }
    const memberRef = db.doc(`households/${invitation.householdId}/members/${actor.uid}`)
    const userRef = db.doc(`users/${actor.uid}`)
    const now = Timestamp.now()
    transaction.set(memberRef, {
      userId: actor.uid,
      householdId: invitation.householdId,
      displayName: actor.displayName,
      role: invitation.role,
      joinedAt: now,
    })
    transaction.set(
      userRef,
      {
        id: actor.uid,
        email: actor.email,
        displayName: actor.displayName,
        householdIds: FieldValue.arrayUnion(invitation.householdId),
        updatedAt: now,
        createdAt: now,
      },
      { merge: true },
    )
    transaction.update(ref, { status: 'ACCEPTED', acceptedAt: now, acceptedBy: actor.uid })
    writeAudit(db, transaction, {
      householdId: invitation.householdId,
      userId: actor.uid,
      action: 'ACCEPT_INVITATION',
      entityType: 'INVITATION',
      entityId: invitation.id,
      after: { status: 'ACCEPTED', acceptedBy: actor.uid },
    })
  })
  return { invitationId: input.invitationId }
})

export const revokeInvitation = secureCallable(invitationIdSchema, async (input, actor) => {
  const ref = db.doc(`invitations/${input.invitationId}`)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'Invitation not found.')
  const invitation = snapshot.data() as Invitation
  await requireMember(invitation.householdId, actor.uid, ['OWNER', 'ADMIN'])
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref)
    if (current.get('status') !== 'PENDING')
      throw new HttpsError('failed-precondition', 'Only pending invitations can be revoked.')
    transaction.update(ref, { status: 'REVOKED' })
    writeAudit(db, transaction, {
      householdId: invitation.householdId,
      userId: actor.uid,
      action: 'REVOKE_INVITATION',
      entityType: 'INVITATION',
      entityId: invitation.id,
      before: { status: 'PENDING' },
      after: { status: 'REVOKED' },
    })
  })
  return { invitationId: input.invitationId }
})
