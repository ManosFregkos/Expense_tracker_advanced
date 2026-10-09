import { HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import type { JarvisReply } from '@family-expense-tracker/shared'

const outputSchema = z.object({
  status: z.string(),
  output: z.array(
    z
      .object({
        type: z.string(),
        name: z.string().optional(),
        call_id: z.string().optional(),
        arguments: z.string().optional(),
        content: z
          .array(
            z
              .object({
                type: z.string(),
                text: z.string().optional(),
                annotations: z
                  .array(
                    z
                      .object({
                        type: z.string(),
                        url: z.string().optional(),
                        title: z.string().optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
  ),
})

export async function openaiRequest(
  key: string,
  path: string,
  body: string | FormData,
  json = true,
) {
  let response: Response
  try {
    response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      signal: AbortSignal.timeout(40_000),
    })
  } catch {
    throw new HttpsError('unavailable', 'Jarvis could not connect. Please try again.')
  }
  if (!response.ok) {
    // Never expose provider responses: they may contain private prompts or configuration.
    if (response.status === 429)
      throw new HttpsError(
        'resource-exhausted',
        'Jarvis is busy or the AI quota has been reached. Try again shortly.',
      )
    if (response.status === 401 || response.status === 403)
      throw new HttpsError(
        'failed-precondition',
        'The Jarvis API key needs to be configured by the app owner.',
      )
    throw new HttpsError(
      'unavailable',
      'Jarvis is unavailable. Check the AI model configuration or try again.',
    )
  }
  return response
}

export async function runJarvis(
  key: string,
  model: string,
  instructions: string,
  input: unknown[],
  tools: unknown[],
  execute: (name: string, argumentsText: string) => Promise<unknown>,
): Promise<Omit<JarvisReply, 'draft'>> {
  const conversation = [...input]
  for (let round = 0; round < 4; round++) {
    const response = await openaiRequest(
      key,
      'responses',
      JSON.stringify({
        model,
        instructions,
        input: conversation,
        tools,
        store: false,
        max_output_tokens: 1400,
        parallel_tool_calls: false,
      }),
    )
    const parsed = outputSchema.safeParse(await response.json())
    if (!parsed.success || parsed.data.status !== 'completed')
      throw new HttpsError('unavailable', 'Jarvis could not finish the answer. Please try again.')
    const output = parsed.data.output
    const calls = output.filter((item) => item.type === 'function_call')
    if (calls.length) {
      conversation.push(...output)
      for (const call of calls) {
        if (!call.name || !call.call_id || !call.arguments)
          throw new HttpsError('internal', 'Jarvis returned an invalid tool request.')
        const result = await execute(call.name, call.arguments)
        conversation.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result),
        })
      }
      continue
    }
    const sources: JarvisReply['sources'] = []
    const texts: string[] = []
    for (const item of output.filter((item) => item.type === 'message')) {
      for (const content of item.content ?? []) {
        if (content.type === 'output_text' && content.text) texts.push(content.text)
        for (const annotation of content.annotations ?? []) {
          if (
            annotation.type === 'url_citation' &&
            annotation.url &&
            /^https?:\/\//.test(annotation.url) &&
            !sources.some((source) => source.url === annotation.url)
          )
            sources.push({ title: annotation.title ?? annotation.url, url: annotation.url })
        }
      }
    }
    const reply = texts.join('\n').trim()
    if (!reply) throw new HttpsError('unavailable', 'Jarvis returned no answer. Please try again.')
    return { reply: reply.slice(0, 4000), sources }
  }
  throw new HttpsError('resource-exhausted', 'Please ask a simpler question so Jarvis can finish.')
}
