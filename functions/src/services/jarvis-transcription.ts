import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { defineString } from 'firebase-functions/params'
import { HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import {
  JARVIS_AUDIO_MAX_BYTES,
  jarvisTranscribeSchema,
  type JarvisTranscription,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { requireMember } from './permissions.js'
import { jarvisOpenaiKey } from './jarvis-config.js'
import { providerFailure } from './jarvis-agent.js'

const transcriptionModel = defineString('JARVIS_TRANSCRIPTION_MODEL', { default: 'gpt-transcribe' })
const extensions = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/wav': 'wav' } as const

export const jarvisTranscribe = secureCallable(
  jarvisTranscribeSchema,
  async (input, actor): Promise<JarvisTranscription> => {
    await requireMember(input.householdId, actor.uid)
    const key = jarvisOpenaiKey.value()
    if (!key)
      throw new HttpsError(
        'failed-precondition',
        'Configure the OPENAI_API_KEY server secret for transcription.',
      )
    const bytes = Buffer.from(input.audioBase64, 'base64')
    if (!bytes.length || bytes.length > JARVIS_AUDIO_MAX_BYTES)
      throw new HttpsError('invalid-argument', 'Record a shorter command (maximum 3 MB).')
    const rate = db.doc(
      `privateJarvisRateLimits/${createHash('sha256').update(`transcription:${actor.uid}`).digest('hex')}`,
    )
    await db.runTransaction(async (transaction) => {
      const previous = await transaction.get(rate)
      const window = Math.floor(Date.now() / 60_000)
      const count = previous.get('window') === window ? Number(previous.get('count')) : 0
      if (count >= 10)
        throw new HttpsError(
          'resource-exhausted',
          'Wait a minute before recording another command.',
        )
      transaction.set(rate, {
        window,
        count: count + 1,
        expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      })
    })
    const model = transcriptionModel.value()
    const form = new FormData()
    form.append(
      'file',
      new Blob([Uint8Array.from(bytes)], { type: input.mimeType }),
      `command.${extensions[input.mimeType]}`,
    )
    form.append('model', model)
    form.append('response_format', 'json')
    const greek = input.language === 'el-GR'
    if (model === 'gpt-transcribe') form.append('languages[]', greek ? 'el' : 'en')
    else form.append('language', greek ? 'el' : 'en')
    form.append(
      'prompt',
      greek
        ? 'Εντολές προς τον Jarvis για έξοδα, έσοδα, συναλλαγές και εργασίες. Διατήρησε ακριβώς ποσά και νομίσματα. Μην προσθέτεις λέξεις που δεν ακούστηκαν.'
        : 'Commands to Jarvis about expenses, income, transactions and todos. Preserve spoken amounts and currencies exactly. Do not add words that were not spoken.',
    )
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(45_000),
      })
    } catch {
      throw new HttpsError(
        'unavailable',
        'Could not reach the transcription service. Try recording again or type your command.',
      )
    }
    if (!response.ok) await providerFailure(response, model, 'transcription')
    const parsed = z.object({ text: z.string().trim().max(2000) }).safeParse(await response.json())
    if (!parsed.success || !parsed.data.text)
      throw new HttpsError(
        'failed-precondition',
        'No usable speech was transcribed. Try again or type your command.',
      )
    await requireMember(input.householdId, actor.uid)
    // Audio and transcripts are not persisted; the user reviews the returned text before sending.
    return { text: parsed.data.text }
  },
  true,
  { secrets: [jarvisOpenaiKey], timeoutSeconds: 60, maxInstances: 5 },
)
