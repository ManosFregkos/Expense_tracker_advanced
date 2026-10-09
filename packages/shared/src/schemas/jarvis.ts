import { z } from 'zod'
import { currencySchema, shortTextSchema } from './common.js'

const documentId = z
  .string()
  .min(1)
  .max(128)
  .refine((id) => !id.includes('/'))
export const jarvisMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
})
export const jarvisChatSchema = z.object({
  householdId: documentId,
  messages: z
    .array(jarvisMessageSchema)
    .min(1)
    .max(20)
    .refine(
      (messages) => messages.at(-1)?.role === 'user',
      'End the conversation with your question.',
    ),
  webSearch: z.boolean().default(false),
})
export const jarvisExpenseDraftSchema = z
  .object({
    amount: z.string().regex(/^\d+(?:[.,]\d{1,3})?$/),
    currency: currencySchema,
    description: shortTextSchema,
    date: z.iso.date(),
    accountId: documentId.nullable(),
    categoryId: documentId.nullable(),
  })
  .strict()
export const jarvisAudioSchema = z.object({
  householdId: documentId,
  audio: z
    .string()
    .min(4)
    .max(4_000_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mimeType: z.enum(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']),
})
export const jarvisSpeechSchema = z.object({
  householdId: documentId,
  text: z.string().trim().min(1).max(4000),
})
export type JarvisMessage = z.infer<typeof jarvisMessageSchema>
export type JarvisChatInput = z.infer<typeof jarvisChatSchema>
export type JarvisExpenseDraft = z.infer<typeof jarvisExpenseDraftSchema>
export type JarvisAudioInput = z.infer<typeof jarvisAudioSchema>
export type JarvisSpeechInput = z.infer<typeof jarvisSpeechSchema>
export interface JarvisReply {
  reply: string
  draft: JarvisExpenseDraft | null
  sources: Array<{ title: string; url: string }>
}
