import { Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  archiveKidsCustomContentSchema,
  emotionScenarioSchema,
  everydayScenarioSchema,
  learningCardSchema,
  learningDeckSchema,
  learningRelationshipSchema,
  saveKidsCustomContentSchema,
  sequenceDefinitionSchema,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'

const collectionByKind = {
  DECK: 'kidsCustomDecks',
  CARD: 'kidsCustomCards',
  RELATIONSHIP: 'kidsRelationships',
  EVERYDAY_SCENARIO: 'kidsEverydayScenarios',
  SEQUENCE: 'kidsSequences',
  EMOTION_SCENARIO: 'kidsEmotionScenarios',
} as const

function assertAdmin(member: DocumentSnapshot) {
  if (!member.exists || !['OWNER', 'ADMIN'].includes(String(member.get('role'))))
    throw new HttpsError('permission-denied', 'Parent access is required.')
}

function parseContent(kind: keyof typeof collectionByKind, value: Record<string, unknown>) {
  const normalized = { ...value, origin: 'CUSTOM' as const }
  const schema = {
    DECK: learningDeckSchema,
    CARD: learningCardSchema,
    RELATIONSHIP: learningRelationshipSchema,
    EVERYDAY_SCENARIO: everydayScenarioSchema,
    SEQUENCE: sequenceDefinitionSchema,
    EMOTION_SCENARIO: emotionScenarioSchema,
  }[kind]
  const result = schema.safeParse(normalized)
  if (!result.success)
    throw new HttpsError(
      'invalid-argument',
      result.error.issues[0]?.message ?? 'Invalid Kids content.',
    )
  return result.data as Record<string, unknown> & { id: string }
}

export const saveKidsCustomContent = secureCallable(
  saveKidsCustomContentSchema,
  async (input, actor) => {
    const memberRef = db.doc('households/' + input.householdId + '/members/' + actor.uid)
    const parsed = parseContent(input.kind, input.content)
    const ref = db.doc(
      'households/' + input.householdId + '/' + collectionByKind[input.kind] + '/' + parsed.id,
    )
    await db.runTransaction(async (transaction) => {
      const [member, existing] = await Promise.all([
        transaction.get(memberRef),
        transaction.get(ref),
      ])
      assertAdmin(member)
      if (
        existing.exists &&
        (existing.get('householdId') !== input.householdId || existing.get('origin') !== 'CUSTOM')
      )
        throw new HttpsError('permission-denied', 'Content ownership does not match.')
      const now = Timestamp.now()
      const existingData = (existing.data() ?? {}) as Record<string, unknown>
      const createdBy =
        typeof existingData.createdBy === 'string' ? existingData.createdBy : actor.uid
      const createdAt = existingData.createdAt ?? now
      transaction.set(
        ref,
        {
          ...parsed,
          householdId: input.householdId,
          origin: 'CUSTOM',
          createdBy,
          createdAt,
          updatedAt: now,
          archivedAt: null,
        },
        { merge: false },
      )
    })
    return { contentId: parsed.id }
  },
)

export const archiveKidsCustomContent = secureCallable(
  archiveKidsCustomContentSchema,
  async (input, actor) => {
    const memberRef = db.doc('households/' + input.householdId + '/members/' + actor.uid)
    const ref = db.doc(
      'households/' +
        input.householdId +
        '/' +
        collectionByKind[input.kind] +
        '/' +
        input.contentId,
    )
    await db.runTransaction(async (transaction) => {
      const [member, content] = await Promise.all([
        transaction.get(memberRef),
        transaction.get(ref),
      ])
      assertAdmin(member)
      if (
        !content.exists ||
        content.get('householdId') !== input.householdId ||
        content.get('origin') !== 'CUSTOM'
      )
        throw new HttpsError('not-found', 'Custom content was not found.')
      transaction.update(ref, {
        enabled: false,
        archivedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    return { contentId: input.contentId }
  },
)
