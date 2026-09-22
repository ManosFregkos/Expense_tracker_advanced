import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  archiveKidsContentSchema,
  childProfileInputSchema,
  completeKidsRoundSchema,
  completeKidsSessionSchema,
  customLogicSchema,
  startKidsSessionSchema,
  nextKidsDifficulty,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { requireMember } from './permissions.js'
import { writeAudit } from './audit.js'

const root = (householdId: string) => db.collection('households').doc(householdId)

export const saveChildProfile = secureCallable(childProfileInputSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = input.childProfileId
    ? root(input.householdId).collection('childProfiles').doc(input.childProfileId)
    : root(input.householdId).collection('childProfiles').doc()
  await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(ref)
    if (input.childProfileId && (!previous.exists || previous.get('archivedAt')))
      throw new HttpsError('not-found', 'Child profile not found.')
    const now = Timestamp.now()
    const { childProfileId: _ignored, ...fields } = input
    void _ignored
    const update = { ...fields, id: ref.id, updatedAt: now }
    transaction.set(
      ref,
      previous.exists ? update : { ...update, createdAt: now, createdBy: actor.uid },
      { merge: true },
    )
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: previous.exists ? 'CHILD_PROFILE_UPDATED' : 'CHILD_PROFILE_CREATED',
      entityType: 'CHILD_PROFILE',
      entityId: ref.id,
      after: { displayName: input.displayName, ageBand: input.ageBand },
    })
  })
  return { childProfileId: ref.id }
})

export const saveKidsCustomContent = secureCallable(customLogicSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const ref = input.contentId
    ? root(input.householdId).collection('kidsCustomContent').doc(input.contentId)
    : root(input.householdId).collection('kidsCustomContent').doc()
  await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(ref)
    if (input.contentId && (!previous.exists || previous.get('archivedAt')))
      throw new HttpsError('not-found', 'Content not found.')
    const now = Timestamp.now()
    const { contentId: _ignored, ...fields } = input
    void _ignored
    transaction.set(
      ref,
      {
        ...fields,
        id: ref.id,
        gameType: 'LOGIC',
        origin: 'CUSTOM',
        enabled: true,
        contentVersion: 1,
        updatedAt: now,
        ...(previous.exists ? {} : { createdAt: now, createdBy: actor.uid }),
      },
      { merge: true },
    )
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: previous.exists ? 'KIDS_CUSTOM_CONTENT_UPDATED' : 'KIDS_CUSTOM_CONTENT_CREATED',
      entityType: 'KIDS_CUSTOM_CONTENT',
      entityId: ref.id,
      after: { title: input.title },
    })
  })
  return { contentId: ref.id }
})

export const archiveKidsCustomContent = secureCallable(
  archiveKidsContentSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid)
    const ref = root(input.householdId).collection('kidsCustomContent').doc(input.contentId)
    await db.runTransaction(async (transaction) => {
      const previous = await transaction.get(ref)
      if (!previous.exists || previous.get('archivedAt'))
        throw new HttpsError('not-found', 'Content not found.')
      transaction.update(ref, {
        enabled: false,
        archivedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      writeAudit(db, transaction, {
        householdId: input.householdId,
        userId: actor.uid,
        action: 'KIDS_CUSTOM_CONTENT_ARCHIVED',
        entityType: 'KIDS_CUSTOM_CONTENT',
        entityId: ref.id,
      })
    })
    return { contentId: ref.id }
  },
)

export const startKidsSession = secureCallable(startKidsSessionSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const house = root(input.householdId)
  const profile = await house.collection('childProfiles').doc(input.childProfileId).get()
  if (
    !profile.exists ||
    profile.get('archivedAt') ||
    profile.get('householdId') !== input.householdId
  )
    throw new HttpsError('not-found', 'Child profile not found.')
  const ref = house.collection('kidsSessions').doc(input.sessionId)
  await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(ref)
    if (previous.exists) {
      if (
        previous.get('childProfileId') !== input.childProfileId ||
        previous.get('createdBy') !== actor.uid ||
        previous.get('gameType') !== input.gameType
      )
        throw new HttpsError('permission-denied', 'Session belongs to another player.')
      return
    }
    transaction.set(ref, {
      ...input,
      id: ref.id,
      createdBy: actor.uid,
      startedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      roundCount: (profile.get('sessionLength') as number | undefined) ?? 5,
      completedRoundCount: 0,
    })
  })
  return { sessionId: ref.id }
})

export const completeKidsRound = secureCallable(completeKidsRoundSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid)
  const house = root(input.householdId)
  const sessionRef = house.collection('kidsSessions').doc(input.sessionId)
  const attemptRef = house.collection('kidsAttempts').doc(`${input.sessionId}_${input.roundId}`)
  await db.runTransaction(async (transaction) => {
    const [session, existing] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(attemptRef),
    ])
    if (
      !session.exists ||
      session.get('createdBy') !== actor.uid ||
      session.get('childProfileId') !== input.childProfileId ||
      session.get('householdId') !== input.householdId ||
      session.get('completedAt')
    )
      throw new HttpsError('failed-precondition', 'Session is unavailable.')
    if (existing.exists) return
    if ((session.get('completedRoundCount') as number) >= (session.get('roundCount') as number))
      throw new HttpsError('failed-precondition', 'Session is complete.')
    const profile = await transaction.get(
      house.collection('childProfiles').doc(input.childProfileId),
    )
    if (!profile.exists || profile.get('archivedAt'))
      throw new HttpsError('not-found', 'Child profile not found.')
    const progressRef = house
      .collection('kidsProgress')
      .doc(`${input.childProfileId}_${session.get('gameType') as string}`)
    const progress = await transaction.get(progressRef)
    const gameType = session.get('gameType') as string
    transaction.set(attemptRef, {
      ...input,
      id: attemptRef.id,
      gameType,
      createdAt: Timestamp.now(),
    })
    transaction.update(sessionRef, { completedRoundCount: FieldValue.increment(1) })
    const recent = (progress.get('recentResults') as boolean[] | undefined) ?? []
    const next = [...recent, input.isCorrect && input.attemptCount === 1].slice(-6)
    const oldDifficulty = (progress.get('currentDifficulty') as number | undefined) ?? 1
    const roundsSinceChange = (progress.get('roundsSinceChange') as number | undefined) ?? 0
    const mode = profile.get('defaultDifficultyMode') as 'AUTO' | 'EASY' | 'MEDIUM' | 'HARD'
    const difficulty = nextKidsDifficulty(oldDifficulty, next, roundsSinceChange, mode)
    transaction.set(
      progressRef,
      {
        childProfileId: input.childProfileId,
        householdId: input.householdId,
        gameType,
        currentDifficulty: difficulty,
        roundsPlayed: FieldValue.increment(1),
        skillExposure: { [input.skill]: FieldValue.increment(1) },
        recentResults: next,
        roundsSinceChange: difficulty === oldDifficulty ? roundsSinceChange + 1 : 0,
        lastPlayedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )
  })
  return { attemptId: attemptRef.id }
})

export const completeKidsSession = secureCallable(
  completeKidsSessionSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid)
    const house = root(input.householdId)
    const ref = house.collection('kidsSessions').doc(input.sessionId)
    await db.runTransaction(async (transaction) => {
      const session = await transaction.get(ref)
      if (
        !session.exists ||
        session.get('createdBy') !== actor.uid ||
        session.get('childProfileId') !== input.childProfileId ||
        session.get('householdId') !== input.householdId
      )
        throw new HttpsError('permission-denied', 'Session unavailable.')
      if (session.get('completedAt')) return
      if ((session.get('completedRoundCount') as number) !== (session.get('roundCount') as number))
        throw new HttpsError('failed-precondition', 'Rounds remain.')
      transaction.update(ref, { completedAt: Timestamp.now() })
      const progressRef = house
        .collection('kidsProgress')
        .doc(`${input.childProfileId}_${session.get('gameType') as string}`)
      transaction.set(
        progressRef,
        { sessionsPlayed: FieldValue.increment(1), updatedAt: Timestamp.now() },
        { merge: true },
      )
    })
    return { sessionId: ref.id }
  },
)
