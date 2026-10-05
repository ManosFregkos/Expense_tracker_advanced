import { beforeEach, describe, expect, it, vi } from 'vitest'
import { askStudyNotes, processStudyTranscript } from './study.js'
import { generateTranscriptNotes, answerFromNotes } from './study-ai-provider.js'
const state = vi.hoisted(() => ({
  usage: {} as Record<string, unknown>,
  paths: [] as string[],
  key: 'test-key',
}))
vi.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => state.key }),
  defineString: () => ({ value: () => 'gpt-4.1-mini' }),
}))
vi.mock('../firebase.js', () => ({
  db: {
    doc: (path: string) => {
      state.paths.push(path)
      return path
    },
    runTransaction: async (
      fn: (transaction: {
        get: () => Promise<{ get: (key: string) => unknown }>
        set: (ref: string, value: Record<string, unknown>) => void
      }) => Promise<void>,
    ) =>
      fn({
        get: async () => ({ get: (key: string) => state.usage[key] }),
        set: (_ref, value) => {
          state.usage = value
        },
      }),
  },
}))
vi.mock('./study-ai-provider.js', () => ({
  generateTranscriptNotes: vi.fn().mockResolvedValue({ title: 'notes' }),
  answerFromNotes: vi.fn().mockResolvedValue({ answer: 'answer', sourceIds: [] }),
}))
const input = {
  transcript: 'Retrieval supplies relevant passages to a model. '.repeat(4),
  courseTitle: 'RAG',
  lessonTitle: '',
  style: 'detailed',
}
function request(data: unknown, verified = true) {
  return {
    data,
    auth: { uid: 'alice', token: { email: 'alice@example.test', email_verified: verified } },
  } as Parameters<typeof processStudyTranscript.run>[0]
}
beforeEach(() => {
  state.usage = {}
  state.paths = []
  state.key = 'test-key'
  vi.clearAllMocks()
})
describe('authenticated study AI callables', () => {
  it('requires authentication and verified email before provider requests', async () => {
    await expect(
      processStudyTranscript.run({ data: input } as Parameters<
        typeof processStudyTranscript.run
      >[0]),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(processStudyTranscript.run(request(input, false))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    expect(generateTranscriptNotes).not.toHaveBeenCalled()
  })
  it('rejects malformed input before claiming usage', async () => {
    await expect(
      processStudyTranscript.run(request({ ...input, transcript: 'short' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(state.paths).toEqual([])
  })
  it('does not claim quota when the service is unconfigured', async () => {
    state.key = ''
    await expect(processStudyTranscript.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    expect(state.paths).toEqual([])
  })
  it('claims quota for the authenticated uid and throttles combined AI operations', async () => {
    await processStudyTranscript.run(request(input))
    expect(state.paths).toEqual(['privateStudyAiUsage/alice'])
    expect(state.usage.count).toBe(1)
    const ask = {
      question: 'What is retrieval?',
      passages: [{ id: 'n1', title: 'Retrieval', text: 'Retrieve passages.' }],
    }
    await expect(askStudyNotes.run(request(ask))).rejects.toMatchObject({
      code: 'resource-exhausted',
    })
    expect(answerFromNotes).not.toHaveBeenCalled()
  })
  it('enforces daily usage and resets on the next UTC day', async () => {
    state.usage = { day: new Date().toISOString().slice(0, 10), count: 40, lastRequestAt: 0 }
    await expect(processStudyTranscript.run(request(input))).rejects.toMatchObject({
      code: 'resource-exhausted',
    })
    state.usage = { day: '2000-01-01', count: 40, lastRequestAt: 0 }
    await processStudyTranscript.run(request(input))
    expect(state.usage.count).toBe(1)
  })
})
