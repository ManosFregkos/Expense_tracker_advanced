import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError } from 'firebase-functions/v2/https'
import { processStudyTranscriptSchema, askStudyNotesSchema } from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { answerFromNotes, generateTranscriptNotes } from './study-ai-provider.js'

const studyApiKey = defineSecret('STUDY_OPENAI_API_KEY')
const studyModel = defineString('STUDY_AI_MODEL', { default: 'gpt-4.1-mini' })
const aiOptions = { secrets: [studyApiKey], timeoutSeconds: 120, maxInstances: 5 }

// Transactional quotas are shared by all function instances, and cannot be reset by the client.
async function claimRequest(uid: string) {
  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  const ref = db.doc(`privateStudyAiUsage/${uid}`)
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref)
    const lastRequestAt = Number(doc.get('lastRequestAt') ?? 0)
    const count = doc.get('day') === day ? Number(doc.get('count') ?? 0) : 0
    if (now - lastRequestAt < 5000)
      throw new HttpsError(
        'resource-exhausted',
        'Please wait a few seconds before another AI request.',
      )
    if (count >= 40)
      throw new HttpsError(
        'resource-exhausted',
        'You have used your 40 AI requests for today. The limit resets at midnight UTC.',
      )
    transaction.set(ref, { day, count: count + 1, lastRequestAt: now })
  })
}
function configuredKey() {
  const key = studyApiKey.value().trim()
  if (!key)
    throw new HttpsError(
      'failed-precondition',
      'AI is not configured. Set the STUDY_OPENAI_API_KEY Firebase secret and deploy the study functions. See docs/STUDY_STUDIO.md.',
    )
  return key
}

export const processStudyTranscript = secureCallable(
  processStudyTranscriptSchema,
  async (input, actor) => {
    const key = configuredKey()
    await claimRequest(actor.uid)
    return generateTranscriptNotes(key, studyModel.value(), input)
  },
  true,
  aiOptions,
)

export const askStudyNotes = secureCallable(
  askStudyNotesSchema,
  async (input, actor) => {
    const key = configuredKey()
    await claimRequest(actor.uid)
    return answerFromNotes(key, studyModel.value(), input)
  },
  true,
  aiOptions,
)
