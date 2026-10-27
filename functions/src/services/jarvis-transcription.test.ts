import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jarvisTranscribe } from './jarvis-transcription.js'
import { requireMember } from './permissions.js'

const state = vi.hoisted(() => ({ count: 0, writes: [] as { path: string; data: object }[] }))
vi.mock('../firebase.js', () => ({
  db: {
    doc: (path: string) => ({ path }),
    runTransaction: async (callback: (value: unknown) => Promise<unknown>) =>
      callback({
        get: async () => ({
          get: (key: string) => (key === 'window' ? Math.floor(Date.now() / 60_000) : state.count),
        }),
        set: (ref: { path: string }, data: object) => state.writes.push({ path: ref.path, data }),
      }),
  },
}))
vi.mock('./permissions.js', () => ({ requireMember: vi.fn(async () => undefined) }))
vi.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => 'test-key' }),
  defineString: () => ({ value: () => 'gpt-transcribe' }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  state.count = 0
  state.writes = []
})
afterEach(() => vi.unstubAllGlobals())
const data = {
  householdId: 'h1',
  language: 'en-US',
  mimeType: 'audio/webm',
  audioBase64: Buffer.from('test-only audio').toString('base64'),
}
const request = (input: unknown = data, uid = 'u1', verified = true) =>
  ({ data: input, auth: { uid, token: { email_verified: verified } } }) as Parameters<
    typeof jarvisTranscribe.run
  >[0]

describe('recorded Jarvis transcription', () => {
  it('uses the separate audio model with language hints and returns text without writing audio or tasks', async () => {
    const provider = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: 'Add 30 euros supermarket' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', provider)
    expect(await jarvisTranscribe.run(request())).toEqual({ text: 'Add 30 euros supermarket' })
    expect(requireMember).toHaveBeenCalledWith('h1', 'u1')
    expect(requireMember).toHaveBeenCalledTimes(2)
    const [endpoint, options] = provider.mock.calls[0]! as unknown as [string, RequestInit]
    expect(endpoint).toBe('https://api.openai.com/v1/audio/transcriptions')
    const form = options.body as FormData
    expect(form.get('model')).toBe('gpt-transcribe')
    expect(form.getAll('languages[]')).toEqual(['en'])
    expect(form.has('language')).toBe(false)
    expect((form.get('file') as File).name).toBe('command.webm')
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0]?.path).toMatch(/^privateJarvisRateLimits\//)
    expect(JSON.stringify(state.writes)).not.toContain('audioBase64')
  })
  it('rejects unverified users and revoked membership before contacting OpenAI', async () => {
    const provider = vi.fn()
    vi.stubGlobal('fetch', provider)
    await expect(jarvisTranscribe.run(request(data, 'u1', false))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    vi.mocked(requireMember).mockRejectedValueOnce(new Error('Membership revoked'))
    await expect(jarvisTranscribe.run(request())).rejects.toThrow('Membership revoked')
    expect(provider).not.toHaveBeenCalled()
  })
  it('validates MIME/base64 and rate limits recordings before calling the provider', async () => {
    const provider = vi.fn()
    vi.stubGlobal('fetch', provider)
    await expect(
      jarvisTranscribe.run(request({ ...data, mimeType: 'text/html' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(
      jarvisTranscribe.run(request({ ...data, audioBase64: 'not!base64' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    state.count = 10
    await expect(jarvisTranscribe.run(request())).rejects.toMatchObject({
      code: 'resource-exhausted',
    })
    expect(provider).not.toHaveBeenCalled()
  })
  it('does not turn an empty transcription into a command', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ text: '' }), { status: 200 })),
    )
    await expect(jarvisTranscribe.run(request())).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
})
