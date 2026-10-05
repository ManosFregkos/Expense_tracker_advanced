import { afterEach, describe, expect, it, vi } from 'vitest'
import { answerFromNotes, generateTranscriptNotes } from './study-ai-provider.js'

const transcript = {
  transcript: 'This lesson covers retrieval and grounding in RAG. '.repeat(5),
  courseTitle: 'RAG',
  lessonTitle: '',
  style: 'detailed' as const,
}
const generated = {
  title: 'RAG notes',
  summary: 'Retrieve relevant evidence.',
  markdown: '## RAG\n\nUse retrieved passages.',
  tags: ['RAG'],
  flashcards: [{ question: 'Why retrieve?', answer: 'To supply relevant evidence.' }],
}
const response = (content: unknown, status = 'completed') =>
  new Response(
    JSON.stringify({
      status,
      output: [
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(content) }] },
      ],
    }),
    { status: 200 },
  )
afterEach(() => vi.unstubAllGlobals())

describe('study AI provider', () => {
  it('uses server credentials, bounded output, no storage, and strict structured output', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(generated))
    vi.stubGlobal('fetch', fetchMock)
    expect(await generateTranscriptNotes('test-key', 'gpt-4.1-mini', transcript)).toEqual(generated)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-key' })
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
      string,
      unknown
    >
    expect(body).toMatchObject({
      store: false,
      max_output_tokens: 6500,
      text: { format: { type: 'json_schema', strict: true } },
    })
    expect(body.instructions).toContain('untrusted source material')
  })
  it('rejects incomplete responses, refusals, and malformed model output', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(response(generated, 'incomplete'))
    await expect(generateTranscriptNotes('key', 'model', transcript)).rejects.toMatchObject({
      code: 'data-loss',
    })
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'refusal' }] }],
        }),
      ),
    )
    await expect(generateTranscriptNotes('key', 'model', transcript)).rejects.toMatchObject({
      code: 'data-loss',
    })
    fetchMock.mockResolvedValueOnce(response({ title: 'Only a title' }))
    await expect(generateTranscriptNotes('key', 'model', transcript)).rejects.toMatchObject({
      code: 'data-loss',
    })
  })
  it('provides useful errors without disclosing upstream error bodies', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    for (const [status, code] of [
      [401, 'failed-precondition'],
      [429, 'resource-exhausted'],
      [500, 'unavailable'],
    ] as const) {
      fetchMock.mockResolvedValueOnce(new Response('secret upstream detail', { status }))
      await expect(generateTranscriptNotes('key', 'model', transcript)).rejects.toMatchObject({
        code,
      })
    }
    fetchMock.mockRejectedValueOnce(new Error('network failure'))
    await expect(generateTranscriptNotes('key', 'model', transcript)).rejects.toMatchObject({
      code: 'unavailable',
    })
  })
  it('rejects fabricated citations and accepts only supplied source IDs', async () => {
    const input = {
      question: 'How does RAG work?',
      passages: [{ id: 'rag-note', title: 'RAG', text: 'Retrieve relevant passages.' }],
    }
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(
      response({ answer: 'RAG retrieves passages [1].', sourceIds: ['invented-id'] }),
    )
    await expect(answerFromNotes('key', 'model', input)).rejects.toMatchObject({
      code: 'data-loss',
    })
    fetchMock.mockResolvedValueOnce(
      response({ answer: 'RAG retrieves passages [1].', sourceIds: ['rag-note'] }),
    )
    expect(await answerFromNotes('key', 'model', input)).toMatchObject({ sourceIds: ['rag-note'] })
  })
})
