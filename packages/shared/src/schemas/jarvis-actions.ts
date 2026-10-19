import { z } from 'zod'
import { amountMinorSchema, currencySchema, isoDateSchema, shortTextSchema } from './common.js'
import { taskCoreInputSchema, taskRecurrenceInputSchema } from './task.js'

const documentId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((id) => !id.includes('/'))
const localDate = z.iso.date()
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const recurrence = taskRecurrenceInputSchema.strict().safeExtend({
  untilDate: localDate.optional(),
})

// Reuse task business validation, but reject unknown keys at every object boundary.
export const jarvisTaskPayloadSchema = taskCoreInputSchema.strict().safeExtend({
  status: z.literal('TODO').default('TODO'),
  dueDate: localDate.nullable().optional(),
  recurrence: recurrence.nullable().optional(),
})

export const jarvisActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('CREATE_EXPENSE'),
    payload: z.strictObject({
      accountId: documentId,
      categoryId: documentId,
      amountMinor: amountMinorSchema,
      currency: currencySchema,
      description: shortTextSchema,
      transactionDate: isoDateSchema,
      merchant: z.string().trim().max(160).optional(),
      notes: z.string().trim().max(1000).optional(),
      tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    }),
  }),
  z.strictObject({ type: z.literal('CREATE_TASK'), payload: jarvisTaskPayloadSchema }),
  z.strictObject({
    type: z.literal('COMPLETE_TASK'),
    payload: z.strictObject({ taskId: documentId, expectedVersion: z.number().int().positive() }),
  }),
  z.strictObject({
    type: z.literal('RESCHEDULE_TASK'),
    payload: z.strictObject({
      taskId: documentId,
      expectedVersion: z.number().int().positive(),
      dueDate: localDate,
      dueTime: localTime.nullable(),
    }),
  }),
])

export const jarvisPrepareActionSchema = z.strictObject({
  householdId: documentId,
  sessionId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  action: jarvisActionSchema,
})
export const jarvisActionReferenceSchema = z.strictObject({
  householdId: documentId,
  sessionId: z.string().uuid(),
  proposalId: z.string().regex(/^[a-f0-9]{64}$/),
})

export type JarvisAction = z.infer<typeof jarvisActionSchema>
export type JarvisPrepareActionInput = z.infer<typeof jarvisPrepareActionSchema>
export type JarvisActionReference = z.infer<typeof jarvisActionReferenceSchema>
export type JarvisActionStatus = 'PENDING' | 'COMMITTED' | 'CANCELLED' | 'EXPIRED'
export interface JarvisActionResult {
  entityId: string
  nextTaskId?: string | null
}
export interface JarvisActionProposal {
  proposalId: string
  householdId: string
  sessionId: string
  action: JarvisAction
  summary: string
  status: JarvisActionStatus
  createdAt: string
  expiresAt: string
  result: JarvisActionResult | null
}
