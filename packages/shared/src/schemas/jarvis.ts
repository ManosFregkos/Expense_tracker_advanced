import { z } from 'zod'
import { currencySchema, shortTextSchema } from './common.js'
import type { TaskCoreInput } from './task.js'

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
  language: z.enum(['en-US', 'el-GR']).default('el-GR'),
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
  language: z.enum(['en-US', 'el-GR']).default('el-GR'),
})
export const jarvisSpeechSchema = z.object({
  householdId: documentId,
  text: z.string().trim().min(1).max(4000),
})
export const jarvisRealtimeSchema = z.object({
  householdId: documentId,
  sdp: z.string().min(1).max(64_000).startsWith('v=0'),
  language: z.enum(['en-US', 'el-GR']),
  webSearch: z.boolean().default(false),
})
export type JarvisMessage = z.infer<typeof jarvisMessageSchema>
export type JarvisChatInput = z.infer<typeof jarvisChatSchema>
export type JarvisExpenseDraft = z.infer<typeof jarvisExpenseDraftSchema>
export type JarvisAudioInput = z.infer<typeof jarvisAudioSchema>
export type JarvisSpeechInput = z.infer<typeof jarvisSpeechSchema>
export type JarvisRealtimeInput = z.infer<typeof jarvisRealtimeSchema>
export interface JarvisRealtimeSession {
  sdp: string
  model: string
}
export interface JarvisReply {
  reply: string
  draft: JarvisExpenseDraft | null
  sources: Array<{ title: string; url: string }>
  taskAction?: JarvisTaskAction | null
  briefing?: JarvisMorningBriefing | null
}

export interface JarvisBriefingTask {
  id: string
  title: string
  dueDate: string | null
  dueTime: string | null
}
export interface JarvisBriefingTasks {
  tasks: JarvisBriefingTask[]
  truncated: boolean
}
export interface JarvisMorningBriefing {
  date: string
  timeZone: string
  scope: 'mine' | 'household'
  today: JarvisBriefingTasks
  overdue: JarvisBriefingTasks
  upcomingBills: JarvisBriefingTasks & {
    throughDate: string
    listConfigured: boolean
    source: 'bill_tasks'
  }
  monthlySpending: {
    month: string
    currency: string
    currencyMinorDigits: number
    expenseMinor: number | null
    available: boolean
  }
}

// Proposals contain no write authority. The user explicitly confirms through the
// existing authenticated task APIs, which recheck membership and task versions.
export type JarvisTaskAction =
  | {
      kind: 'create'
      clientRequestId: string
      task: TaskCoreInput
      assigneeName: string | null
      listName: string | null
    }
  | { kind: 'complete'; taskId: string; title: string; expectedVersion: number; recurring: boolean }
  | {
      kind: 'reschedule'
      taskId: string
      expectedVersion: number
      task: TaskCoreInput
      previousDueDate: string | null
      previousDueTime: string | null
    }
