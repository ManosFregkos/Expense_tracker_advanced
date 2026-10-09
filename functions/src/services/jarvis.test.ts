import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jarvisChat, jarvisTranscribe, reserveJarvisRequest } from './jarvis.js'
import { runJarvis } from './jarvis-provider.js'
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
