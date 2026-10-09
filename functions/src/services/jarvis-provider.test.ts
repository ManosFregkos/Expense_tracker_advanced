import { afterEach, describe, expect, it, vi } from 'vitest'
import { openaiRequest, runJarvis } from './jarvis-provider.js'

afterEach(() => vi.unstubAllGlobals())
const result = (output: unknown[], status = 'completed') =>
  new Response(JSON.stringify({ status, output }))
describe('Jarvis OpenAI provider', () => {
  it('returns actual tool results to the model and extracts clickable citations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        result([
          {
            type: 'function_call',
            name: 'get_monthly_spending',
            call_id: 'call1',
            arguments: '{"month":"2026-10"}',
          },
        ]),
      )
      .mockResolvedValueOnce(
        result([
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Your household spent €25.',
                annotations: [
                  { type: 'url_citation', title: 'Source', url: 'https://example.com' },
                  { type: 'url_citation', url: 'javascript:alert(1)' },
                ],
              },
            ],
          },
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)
    const execute = vi.fn().mockResolvedValue({ expenseMinor: 2500 })
    const reply = await runJarvis(
      'secret',
      'model',
      'instructions',
      [{ role: 'user', content: 'spending?' }],
      [],
      execute,
    )
    expect(reply).toEqual({
      reply: 'Your household spent €25.',
      sources: [{ title: 'Source', url: 'https://example.com' }],
    })
    expect(execute).toHaveBeenCalledWith('get_monthly_spending', '{"month":"2026-10"}')
    const body = (fetchMock.mock.calls[1]?.[1] as { body: string }).body
    expect(body).toContain('function_call_output')
    expect(body).toContain('2500')
    expect(body).toContain('"store":false')
  })
  it('bounds tool loops and rejects incomplete answers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(result([], 'incomplete')))
    await expect(runJarvis('secret', 'model', '', [], [], vi.fn())).rejects.toMatchObject({
      code: 'unavailable',
    })
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          result([{ type: 'function_call', name: 'unknown', call_id: 'x', arguments: '{}' }]),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      runJarvis('secret', 'model', '', [], [], vi.fn().mockResolvedValue({ error: 'unsupported' })),
    ).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
  it('does not leak API errors or secrets and reports exhausted quota', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('secret private provider details', { status: 401 })),
    )
    await expect(openaiRequest('secret', 'responses', '{}')).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private quota details', { status: 429 })),
    )
    await expect(openaiRequest('secret', 'responses', '{}')).rejects.toMatchObject({
      code: 'resource-exhausted',
    })
  })
})
