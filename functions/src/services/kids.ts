import { Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  completeKidsSessionSchema,
  createKidsChildProfileSchema,
  persistKidsAttemptSchema,
  startKidsSessionSchema,
  updateKidsSettingsSchema,
  type CardLearningProgress,
  type KidsCardSession,
  applySpacedLearning,
  updateModeDifficulty,
  type KidsSettings,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'

function assertMember(member: DocumentSnapshot, roles?: readonly string[]) {
  if (!member.exists) throw new HttpsError('permission-denied', 'Household access denied.')
  if (roles && !roles.includes(String(member.get('role'))))
    throw new HttpsError('permission-denied', 'Your household role cannot perform this action.')
}

function assertChildProfile(profile: DocumentSnapshot, householdId: string) {
  if (!profile.exists || profile.get('householdId') !== householdId) {
    throw new HttpsError('failed-precondition', 'Child profile is not available.')
  }
}

export const createKidsChildProfile = secureCallable(
  createKidsChildProfileSchema,
  async (input, actor) => {
    const ref = db.collection(`households/${input.householdId}/childProfiles`).doc()
    const memberRef = db.doc(`households/${input.householdId}/members/${actor.uid}`)
    const now = Timestamp.now()
    await db.runTransaction(async (transaction) => {
      assertMember(await transaction.get(memberRef), ['OWNER', 'ADMIN'])
      transaction.create(ref, {
        id: ref.id,
        householdId: input.householdId,
        displayName: input.displayName,
        avatar: input.avatar,
        createdBy: actor.uid,
        createdAt: now,
        updatedAt: now,
      })
    })
    return { childProfileId: ref.id }
  },
)

export const updateKidsSettings = secureCallable(updateKidsSettingsSchema, async (input, actor) => {
  const memberRef = db.doc(`households/${input.householdId}/members/${actor.uid}`)
  const profileRef = db.doc(`households/${input.householdId}/childProfiles/${input.childProfileId}`)
  const settingsRef = db.doc(`households/${input.householdId}/kidsSettings/${input.childProfileId}`)
  await db.runTransaction(async (transaction) => {
    const [member, profile, existingSettings] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(profileRef),
      transaction.get(settingsRef),
    ])
    assertMember(member, ['OWNER', 'ADMIN'])
    assertChildProfile(profile, input.householdId)
    const difficulty =
      input.difficultyMode === 'AUTO'
        ? Number(existingSettings.get('currentDifficulty') ?? 1)
        : { EASY: 1, MEDIUM: 2, HARD: 4 }[input.difficultyMode]
    transaction.set(
      settingsRef,
      {
        childProfileId: input.childProfileId,
        narrationEnabled: input.narrationEnabled,
        soundEffectsEnabled: input.soundEffectsEnabled,
        animationsEnabled: input.animationsEnabled,
        sessionLength: input.sessionLength,
        difficultyMode: input.difficultyMode,
        currentDifficulty: difficulty,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )
  })
  return { childProfileId: input.childProfileId }
})

export const startKidsSession = secureCallable(startKidsSessionSchema, async (input, actor) => {
  const ref = db.doc(`households/${input.householdId}/kidsSessions/${input.sessionId}`)
  const memberRef = db.doc(`households/${input.householdId}/members/${actor.uid}`)
  const profileRef = db.doc(`households/${input.householdId}/childProfiles/${input.childProfileId}`)
  await db.runTransaction(async (transaction) => {
    const [member, profile, existing] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(profileRef),
      transaction.get(ref),
    ])
    assertMember(member)
    assertChildProfile(profile, input.householdId)
    if (existing.exists) {
      if (
        existing.get('childProfileId') !== input.childProfileId ||
        existing.get('mode') !== input.mode ||
        existing.get('plannedRounds') !== input.plannedRounds
      )
        throw new HttpsError('already-exists', 'Session ID is already in use.')
      return
    }
    const now = Timestamp.now()
    transaction.create(ref, {
      id: input.sessionId,
      householdId: input.householdId,
      childProfileId: input.childProfileId,
      mode: input.mode,
      deckIds: input.deckIds,
      difficulty: input.difficulty,
      plannedRounds: input.plannedRounds,
      completedRounds: 0,
      status: 'ACTIVE',
      startedAt: now,
      createdAt: now,
    } satisfies KidsCardSession)
  })
  return { sessionId: input.sessionId }
})

export const persistKidsAttempt = secureCallable(persistKidsAttemptSchema, async (input, actor) => {
  const memberRef = db.doc(`households/${input.householdId}/members/${actor.uid}`)
  const profileRef = db.doc(`households/${input.householdId}/childProfiles/${input.childProfileId}`)
  const sessionRef = db.doc(`households/${input.householdId}/kidsSessions/${input.sessionId}`)
  const attemptRef = db.doc(`households/${input.householdId}/kidsAttempts/${input.attemptId}`)
  const progressRef = db.doc(
    `households/${input.householdId}/kidsCardProgress/${input.childProfileId}_${input.contentId}`,
  )
  const settingsRef = db.doc(`households/${input.householdId}/kidsSettings/${input.childProfileId}`)
  let duplicate = false
  await db.runTransaction(async (transaction) => {
    const [member, profile, session, attempt, progress, settings] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(profileRef),
      transaction.get(sessionRef),
      transaction.get(attemptRef),
      transaction.get(progressRef),
      transaction.get(settingsRef),
    ])
    assertMember(member)
    assertChildProfile(profile, input.householdId)
    if (!session.exists) throw new HttpsError('failed-precondition', 'Session not found.')
    if (
      session.get('childProfileId') !== input.childProfileId ||
      (session.get('mode') !== input.mode && session.get('mode') !== 'MIXED_PLAY') ||
      session.get('householdId') !== input.householdId
    )
      throw new HttpsError('permission-denied', 'Session ownership does not match.')
    if (attempt.exists) {
      duplicate = true
      return
    }
    if (session.get('status') !== 'ACTIVE')
      throw new HttpsError('failed-precondition', 'Session is already complete.')
    if (!input.attemptId.startsWith(`${input.sessionId}-${input.roundId}-`))
      throw new HttpsError('invalid-argument', 'Attempt ID does not match the session round.')
    const now = Timestamp.now()
    transaction.create(attemptRef, {
      id: input.attemptId,
      sessionId: input.sessionId,
      householdId: input.householdId,
      childProfileId: input.childProfileId,
      mode: input.mode,
      roundId: input.roundId,
      contentId: input.contentId,
      selectedOptionIds: input.selectedOptionIds,
      isCorrect: input.isCorrect,
      attemptCount: input.attemptCount,
      difficulty: input.difficulty,
      createdAt: now,
    })
    const existing = progress.exists
      ? (progress.data() as CardLearningProgress)
      : {
          childProfileId: input.childProfileId,
          cardId: input.contentId,
          deckId: input.deckId,
          exposureCount: 0,
          recognitionAttempts: 0,
          recognitionSuccesses: 0,
          status: 'NEW' as const,
          updatedAt: now,
        }
    const learning = applySpacedLearning(
      {
        exposureCount: existing.exposureCount,
        recognitionAttempts: existing.recognitionAttempts,
        recognitionSuccesses: existing.recognitionSuccesses,
        consecutiveSuccesses: existing.consecutiveSuccesses ?? 0,
        recentMisses: existing.recentMisses ?? 0,
        status: existing.status,
      },
      input.isCorrect,
    )
    const nextSuggestedAt = Timestamp.fromMillis(
      now.toMillis() + learning.nextIntervalDays * 24 * 60 * 60 * 1000,
    )
    transaction.set(progressRef, {
      ...existing,
      exposureCount: learning.exposureCount,
      recognitionAttempts: learning.recognitionAttempts,
      recognitionSuccesses: learning.recognitionSuccesses,
      consecutiveSuccesses: learning.consecutiveSuccesses,
      recentMisses: learning.recentMisses,
      status: learning.status,
      lastSeenAt: now,
      ...(input.isCorrect ? { lastCorrectAt: now } : {}),
      nextSuggestedAt,
      updatedAt: now,
    } satisfies CardLearningProgress)
    if (settings.exists) {
      const value = settings.data() as KidsSettings
      const nextModeState = updateModeDifficulty(
        value.modeDifficultyState?.[input.mode],
        value.modeDifficulties?.[input.mode] ?? value.currentDifficulty ?? 1,
        { success: input.isCorrect, usedHint: input.attemptCount > 1 },
      )
      transaction.set(
        settingsRef,
        {
          modeDifficultyState: {
            ...(value.modeDifficultyState ?? {}),
            [input.mode]: nextModeState,
          },
          modeDifficulties: {
            ...(value.modeDifficulties ?? {}),
            [input.mode]: nextModeState.level,
          },
          updatedAt: now,
        },
        { merge: true },
      )
    }
  })
  return { attemptId: input.attemptId, duplicate }
})

export const completeKidsSession = secureCallable(
  completeKidsSessionSchema,
  async (input, actor) => {
    const ref = db.doc(`households/${input.householdId}/kidsSessions/${input.sessionId}`)
    const memberRef = db.doc(`households/${input.householdId}/members/${actor.uid}`)
    const profileRef = db.doc(
      `households/${input.householdId}/childProfiles/${input.childProfileId}`,
    )
    let duplicate = false
    await db.runTransaction(async (transaction) => {
      const [member, profile, session] = await Promise.all([
        transaction.get(memberRef),
        transaction.get(profileRef),
        transaction.get(ref),
      ])
      assertMember(member)
      assertChildProfile(profile, input.householdId)
      if (!session.exists) throw new HttpsError('not-found', 'Session not found.')
      if (
        session.get('childProfileId') !== input.childProfileId ||
        session.get('householdId') !== input.householdId
      )
        throw new HttpsError('permission-denied', 'Session ownership does not match.')
      if (session.get('status') === 'COMPLETED') {
        duplicate = true
        return
      }
      if (input.completedRounds !== Number(session.get('plannedRounds'))) {
        throw new HttpsError('invalid-argument', 'Completed rounds do not match the session plan.')
      }
      transaction.update(ref, {
        completedRounds: input.completedRounds,
        status: 'COMPLETED',
        completedAt: Timestamp.now(),
      })
    })
    return { sessionId: input.sessionId, duplicate }
  },
)
