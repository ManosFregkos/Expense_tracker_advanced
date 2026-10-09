import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  jarvisChat,
  jarvisTranscribe,
  jarvisStartRealtime,
  reserveJarvisRequest,
} from './jarvis.js'
import { runJarvis, openaiRequest } from './jarvis-provider.js'
import { requireMember } from './permissions.js'

const store = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  writes: [] as string[],
}))
vi.mock('../firebase.js', () => {
  const doc = (path: string) => ({
    path,
    get: async () => ({
      exists: store.documents.has(path),
      data: () => store.documents.get(path),
      get: (key: string) => store.documents.get(path)?.[key],
    }),
  })
  return {
    db: {
      doc,
      collection: () => {
        const query = {
          where: () => query,
          orderBy: () => query,
          limit: () => query,
          get: async () => ({ docs: [] }),
        }
        return query
      },
      runTransaction: async (callback: (transaction: unknown) => Promise<void>) =>
        callback({
          get: async (ref: ReturnType<typeof doc>) => ref.get(),
          set: (ref: ReturnType<typeof doc>, data: Record<string, unknown>) => {
            store.writes.push(ref.path)
            store.documents.set(ref.path, data)
          },
        }),
    },
  }
})
vi.mock('./permissions.js', () => ({ requireMember: vi.fn(async () => undefined) }))
vi.mock('./jarvis-provider.js', () => ({ runJarvis: vi.fn(), openaiRequest: vi.fn() }))
vi.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => 'test-key' }),
  defineString: (_name: string, options: { default: string }) => ({ value: () => options.default }),
}))
function request(data: unknown) {
  return {
    data,
    auth: { uid: 'u1', token: { email: 'member@example.test', email_verified: true } },
  } as Parameters<typeof jarvisChat.run>[0]
}
const chat = {
  householdId: 'h1',
  messages: [{ role: 'user', content: 'Add a €25 supermarket expense' }],
}
beforeEach(() => {
  store.documents.clear()
  store.writes = []
  vi.clearAllMocks()
  store.documents.set('households/h1', {
    id: 'h1',
    timeZone: 'Europe/Athens',
    defaultCurrency: 'EUR',
  })
})
describe('Jarvis callable boundaries', () => {
  it('serves the Greek morning briefing through the authenticated chat tool without writes', async () => {
    store.documents.set('households/h1/monthlyAnalytics/2026-10', { expenseMinor: 2500 })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T09:00:00Z'))
    try {
      vi.mocked(runJarvis).mockImplementationOnce(
        async (_key, _model, instructions, _input, tools, execute) => {
          expect(instructions).toContain('Greek (Ελληνικά)')
          expect(instructions).toContain('get_morning_briefing')
          expect(tools).toContainEqual(expect.objectContaining({ name: 'get_morning_briefing' }))
          expect(await execute('get_morning_briefing', '{"scope":"household"}')).toMatchObject({
            date: '2026-10-10',
            monthlySpending: { expenseMinor: 2500 },
          })
          return { reply: 'Τα έξοδα του μήνα είναι 25 ευρώ, κύριε.', sources: [] }
        },
      )
      expect(
        await jarvisChat.run(
          request({
            householdId: 'h1',
            messages: [{ role: 'user', content: 'Δώσε μου την πρωινή ενημέρωση' }],
          }),
        ),
      ).toMatchObject({
        taskAction: null,
        draft: null,
        briefing: { date: '2026-10-10', monthlySpending: { expenseMinor: 2500 } },
      })
      expect(requireMember).toHaveBeenCalledWith('h1', 'u1')
      expect(store.writes).toEqual(['privateJarvisUsage/u1'])
    } finally {
      vi.useRealTimers()
    }
  })
  it('exposes the authorized read/proposal tools and returns a task preview without writes', async () => {
    vi.mocked(runJarvis).mockImplementationOnce(
      async (_key, _model, instructions, _input, tools, execute) => {
        expect(instructions).toContain('A spoken yes is not confirmation')
        expect(tools).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'search_transactions' }),
            expect.objectContaining({ name: 'get_account_balances' }),
            expect.objectContaining({ name: 'list_tasks' }),
          ]),
        )
        expect(
          await execute(
            'draft_task_create',
            JSON.stringify({
              title: 'Buy milk',
              dueDate: '2026-10-10',
              dueTime: null,
              priority: 'NONE',
              assigneeUserId: null,
              listId: null,
            }),
          ),
        ).toMatchObject({ saved: false, status: 'confirmation_required' })
        expect(await execute('draft_expense', '{}')).toHaveProperty('error')
        expect(await execute('complete_task', '{"taskId":"t1"}')).toHaveProperty('error')
        return { reply: 'Please confirm the task, Sir.', sources: [] }
      },
    )
    const result = await jarvisChat.run(request(chat))
    expect(result).toMatchObject({
      draft: null,
      taskAction: { kind: 'create', task: { title: 'Buy milk' } },
    })
    expect(store.writes).toEqual(['privateJarvisUsage/u1'])
  })
  it('creates a live session with server configuration and returns SDP without credentials', async () => {
    vi.mocked(openaiRequest).mockResolvedValueOnce(new Response('v=0\r\nanswer'))
    const result = await jarvisStartRealtime.run(
      request({
        householdId: 'h1',
        sdp: 'v=0\r\noffer',
        language: 'el-GR',
        webSearch: true,
      }),
    )
    expect(result).toEqual({ sdp: 'v=0\r\nanswer', model: 'gpt-realtime-2.1-mini' })
    expect(requireMember).toHaveBeenCalledWith('h1', 'u1')
    const [key, path, form, json, headers] = vi.mocked(openaiRequest).mock.calls[0]!
    expect(key).toBe('test-key')
    expect(path).toBe('realtime/calls')
    expect(json).toBe(false)
    expect(headers?.['OpenAI-Safety-Identifier']).toMatch(/^[a-f0-9]{64}$/)
    const data = form as FormData
    expect(data.get('sdp')).toBe('v=0\r\noffer')
    const session = JSON.parse(data.get('session') as string) as {
      audio: { input: { turn_detection: Record<string, unknown> } }
      instructions: string
      tools: Array<Record<string, unknown>>
    }
    expect(session.audio.input.turn_detection).toMatchObject({
      create_response: false,
      interrupt_response: true,
    })
    expect(session.instructions).toContain('Greek')
    expect(session.tools).toEqual([expect.objectContaining({ name: 'ask_app_assistant' })])
    expect(store.writes).toEqual(['privateJarvisUsage/u1'])
  })
  it('checks live-session authentication, verification, membership and SDP before provider access', async () => {
    const data = { householdId: 'h1', sdp: 'v=0\r\noffer', language: 'en-US' }
    await expect(
      jarvisStartRealtime.run({ data } as Parameters<typeof jarvisStartRealtime.run>[0]),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
    const unverified = request(data)
    unverified.auth!.token.email_verified = false
    await expect(jarvisStartRealtime.run(unverified)).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    await expect(
      jarvisStartRealtime.run(request({ ...data, sdp: 'bad SDP' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    vi.mocked(requireMember).mockRejectedValueOnce(new Error('access denied'))
    await expect(jarvisStartRealtime.run(request(data))).rejects.toThrow('access denied')
    expect(openaiRequest).not.toHaveBeenCalled()
  })
  it('requires authentication, membership, and safe household IDs before contacting OpenAI', async () => {
    await expect(
      jarvisChat.run({ data: chat } as Parameters<typeof jarvisChat.run>[0]),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(
      jarvisChat.run(request({ ...chat, householdId: 'h1/members/u2' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    vi.mocked(requireMember).mockRejectedValueOnce(new Error('access denied'))
    await expect(jarvisChat.run(request(chat))).rejects.toThrow('access denied')
    expect(runJarvis).not.toHaveBeenCalled()
  })
  it('returns a draft without writing a transaction or changing balances', async () => {
    const draft = {
      amount: '25.00',
      currency: 'EUR',
      description: 'Supermarket',
      date: '2026-10-09',
      accountId: null,
      categoryId: null,
    }
    vi.mocked(runJarvis).mockImplementationOnce(
      async (_key, _model, _instructions, _input, _tools, execute) => {
        expect(await execute('draft_expense', JSON.stringify(draft))).toMatchObject({
          saved: false,
          status: 'draft_only',
        })
        return { reply: 'Review the expense, Sir.', sources: [] }
      },
    )
    expect(await jarvisChat.run(request(chat))).toMatchObject({
      draft,
      reply: 'Review the expense, Sir.',
    })
    expect(store.writes).toEqual(['privateJarvisUsage/u1'])
  })
  it('rejects invented relation IDs, currencies, dates, and invalid amounts', async () => {
    vi.mocked(runJarvis).mockImplementationOnce(
      async (_key, _model, _instructions, _input, _tools, execute) => {
        const draft = {
          amount: '25',
          currency: 'EUR',
          description: 'Supermarket',
          date: '2026-10-09',
          accountId: null,
          categoryId: null,
        }
        for (const change of [
          { accountId: 'invented' },
          { categoryId: 'invented' },
          { currency: 'USD' },
          { amount: '0' },
          { amount: '1.234' },
          { date: '2026-02-30' },
          { accountId: '../h2' },
        ])
          expect(
            await execute('draft_expense', JSON.stringify({ ...draft, ...change })),
          ).toHaveProperty('error')
        expect(await execute('delete_transaction', '{}')).toHaveProperty('error')
        return { reply: 'Please clarify.', sources: [] }
      },
    )
    expect(await jarvisChat.run(request(chat))).toMatchObject({ draft: null })
  })
  it('uses only the authorized household aggregate and marks its scope', async () => {
    store.documents.set('households/h1/monthlyAnalytics/2026-10', {
      expenseMinor: 2500,
      incomeMinor: 300000,
      transactionCount: 2,
    })
    vi.mocked(runJarvis).mockImplementationOnce(
      async (_key, _model, _instructions, _input, _tools, execute) => {
        expect(await execute('get_monthly_spending', '{"month":"2026-10"}')).toMatchObject({
          scope: 'household',
          expenseMinor: 2500,
          currencyMinorDigits: 2,
        })
        expect(await execute('get_monthly_spending', '{"month":"../h2"}')).toHaveProperty('error')
        return { reply: 'Your household spent €25.', sources: [] }
      },
    )
    await jarvisChat.run(request(chat))
    expect(requireMember).toHaveBeenCalledWith('h1', 'u1')
  })
  it('limits AI requests per user across endpoints and resets the minute window', async () => {
    const now = Date.UTC(2026, 9, 9, 12)
    for (let i = 0; i < 30; i++) await reserveJarvisRequest('u1', now)
    await expect(reserveJarvisRequest('u1', now)).rejects.toMatchObject({
      code: 'resource-exhausted',
    })
    await expect(reserveJarvisRequest('u1', now + 60_000)).resolves.toBeUndefined()
    store.documents.set('privateJarvisUsage/u1', {
      day: Math.floor(now / 86_400_000),
      dayCount: 1000,
    })
    await expect(reserveJarvisRequest('u1', now)).rejects.toMatchObject({
      code: 'resource-exhausted',
    })
  })
  it('answers personal spending using the authenticated member rather than household totals', async () => {
    store.documents.set('households/h1/monthlyAnalytics/2026-10', {
      expenseMinor: 10500,
      byMember: { u1: 2500, u2: 8000 },
    })
    vi.mocked(runJarvis).mockImplementationOnce(
      async (_key, _model, _instructions, _input, _tools, execute) => {
        const result = await execute('get_my_monthly_spending', '{"month":"2026-10","userId":"u2"}')
        expect(result).toMatchObject({ scope: 'personal', expenseMinor: 2500 })
        expect(result).not.toHaveProperty('incomeMinor')
        return { reply: 'You spent €25, Sir.', sources: [] }
      },
    )
    await jarvisChat.run(request(chat))
    expect(requireMember).toHaveBeenCalledWith('h1', 'u1')
  })
  it('rejects unsupported audio payloads before provider access', async () => {
    await expect(
      jarvisTranscribe.run(
        request({ householdId: 'h1', audio: 'not base64', mimeType: 'video/mp4' }) as Parameters<
          typeof jarvisTranscribe.run
        >[0],
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})
