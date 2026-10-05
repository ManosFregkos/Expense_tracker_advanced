import { httpsCallable } from 'firebase/functions'
import {
  generatedStudyNotesSchema,
  studyAnswerSchema,
  type ProcessStudyTranscriptInput,
  type AskStudyNotesInput,
} from '@family-expense-tracker/shared'
import { functions } from '../../lib/firebase'

export async function processTranscript(input: ProcessStudyTranscriptInput) {
  const call = httpsCallable<ProcessStudyTranscriptInput, unknown>(
    functions,
    'processStudyTranscript',
    { timeout: 125000 },
  )
  return generatedStudyNotesSchema.parse((await call(input)).data)
}
export async function askNotes(input: AskStudyNotesInput) {
  const call = httpsCallable<AskStudyNotesInput, unknown>(functions, 'askStudyNotes', {
    timeout: 125000,
  })
  return studyAnswerSchema.parse((await call(input)).data)
}
export function aiError(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'The AI request failed. Please try again.'
  if (/not.found|internal|failed to fetch/i.test(message))
    return 'The study AI functions are unavailable. Configure the server API key and deploy processStudyTranscript and askStudyNotes. Setup is in docs/STUDY_STUDIO.md.'
  return message
}
