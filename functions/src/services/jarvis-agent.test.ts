import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDate, runJarvisAgent } from './jarvis-agent.js'

afterEach(() => vi.unstubAllGlobals())
const answer = (text: string) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
})
const call = (name: string, args: object) => ({
  status: 'completed',
  output: [
    { type: 'reasoning', id: 'r1', summary: [] },
    { type: 'function_call', call_id: 'c1', name, arguments: JSON.stringify(args) },
  ],
})
const transaction = {
  type: 'EXPENSE',
  amount: '30.00',
  currency: 'EUR',
  accountId: 'a1',
  categoryId: 'groceries',
  description: 'Supermarket',
  date: '2026-10-27',
}
function options() {
  return {
    apiKey: 'test-only',
    model: 'test-model',
    context: { today: '2026-10-27' },
    history: [],
    message: 'Add 30 euro supermarket',
    search: vi.fn(async () => ({ matches: [] })),
    validate: vi.fn(async () => undefined),
  }
}
function mockResponses(...values: object[]) {
  const fetchMock = vi.fn()
  for (const value of values)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(value), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
describe('Jarvis provider boundary', () => {
  it('answers everyday questions without proposing a mutation or storing the response at OpenAI', async () => {
    const provider = mockResponses(answer('The sky looks blue because air scatters sunlight.'))
    const config = options()
    const result = await runJarvisAgent(config)
    expect(result.proposal).toBeNull()
    expect(config.validate).not.toHaveBeenCalled()
    const body = JSON.parse((provider.mock.calls[0]![1] as RequestInit).body as string) as {
      store: boolean
      parallel_tool_calls: boolean
      tools: {
        strict: boolean
        parameters: { additionalProperties: boolean; properties: object; required: string[] }
      }[]
    }
    expect(body.store).toBe(false)
    expect(body.parallel_tool_calls).toBe(false)
    for (const tool of body.tools) {
      expect(tool.strict).toBe(true)
      expect(tool.parameters.additionalProperties).toBe(false)
      expect(tool.parameters.required.sort()).toEqual(
        Object.keys(tool.parameters.properties).sort(),
      )
    }
  })
  it('prepares major-unit amounts without claiming they are saved', async () => {
    mockResponses(call('prepare_transaction', transaction))
    const config = options()
    const result = await runJarvisAgent(config)
    expect(result).toMatchObject({
      reply: '',
      proposal: { kind: 'CREATE_TRANSACTION', data: { amount: '30.00' } },
    })
    expect(config.validate).toHaveBeenCalledOnce()
  })
  it('returns validation failures to the model and preserves reasoning/tool items for continuation', async () => {
    const provider = mockResponses(
      call('prepare_transaction', transaction),
      answer('Which account should I use?'),
    )
    const config = options()
    config.validate.mockRejectedValueOnce(new Error('Unknown account'))
    expect(await runJarvisAgent(config)).toMatchObject({
      proposal: null,
      reply: 'Which account should I use?',
    })
    const body = JSON.parse((provider.mock.calls[1]![1] as RequestInit).body as string) as {
      input: { type?: string; output?: string }[]
    }
    expect(body.input.some((item) => item.type === 'reasoning')).toBe(true)
    expect(body.input.at(-1)).toMatchObject({ type: 'function_call_output' })
    expect(body.input.at(-1)?.output).toContain('Invalid action fields')
  })
  it('searches before preparing a deletion', async () => {
    mockResponses(
      call('search_transactions', {
        query: 'supermarket',
        amount: '30',
        currency: 'EUR',
        accountId: null,
        date: '2026-10-26',
        type: 'EXPENSE',
      }),
      call('prepare_deletion', { transactionId: 't1' }),
    )
    const config = options()
    expect(await runJarvisAgent(config)).toMatchObject({ proposal: { kind: 'DELETE_TRANSACTION' } })
    expect(config.search).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '30', date: '2026-10-26' }),
    )
    expect(config.search.mock.invocationCallOrder[0]).toBeLessThan(
      config.validate.mock.invocationCallOrder[0]!,
    )
  })
  it('rejects provider errors without exposing their body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('sensitive provider detail', { status: 401 })),
    )
    await expect(runJarvisAgent(options())).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('(401)'),
    })
  })
  it('identifies inaccessible models without exposing provider messages or untrusted codes', async () => {
    const logger = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'model_not_found', message: 'secret-token must never escape' },
            }),
            { status: 404, headers: { 'x-request-id': 'req_safe123' } },
          ),
      ),
    )
    const error: unknown = await runJarvisAgent({ ...options(), model: 'gpt-6-luna' }).catch(
      (cause: unknown) => cause,
    )
    expect(error).toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('gpt-6-luna'),
      details: { status: 404, code: 'model_not_found', requestId: 'req_safe123' },
    })
    expect(JSON.stringify(error)).not.toContain('secret-token')
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret-token')
    logger.mockRestore()
  })
  it.each([
    [403, null, 'failed-precondition', '(403)'],
    [400, 'invalid_json_schema', 'failed-precondition', '(400)'],
    [429, 'credit_balance_exhausted', 'resource-exhausted', 'credits'],
    [429, 'rate_limit_exceeded', 'resource-exhausted', 'rate-limited'],
    [503, 'server_is_overloaded', 'unavailable', '(503)'],
  ])('classifies provider status %s and code %s', async (status, code, expected, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { code } }), { status })),
    )
    await expect(runJarvisAgent(options())).rejects.toMatchObject({
      code: expected,
      message: expect.stringContaining(message),
    })
  })
  it('rejects multiple simultaneous action calls', async () => {
    const first = call('prepare_transaction', transaction)
    mockResponses({
      ...first,
      output: [...first.output, ...first.output.filter((item) => item.type === 'function_call')],
    })
    const config = options()
    await expect(runJarvisAgent(config)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(config.validate).not.toHaveBeenCalled()
  })
  it('validates real calendar dates rather than accepting rolled-over dates', () => {
    expect(localDate.safeParse('2026-02-30').success).toBe(false)
    expect(localDate.safeParse('2028-02-29').success).toBe(true)
  })
})
