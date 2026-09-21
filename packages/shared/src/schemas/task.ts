import { z } from 'zod'
import {
  TASK_PRIORITIES,
  TASK_RECURRENCE_END_TYPES,
  TASK_RECURRENCE_FREQUENCIES,
  TASK_STATUSES,
} from '../domain/types.js'
import { idSchema } from './common.js'

const documentIdSchema = idSchema.refine((value) => !value.includes('/'), 'Invalid document ID.')
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid local date.')
const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid time.')
const nullableId = documentIdSchema.nullable().optional()
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20).default([])

export const taskRecurrenceInputSchema = z
  .object({
    frequency: z.enum(TASK_RECURRENCE_FREQUENCIES),
    interval: z.number().int().min(1).max(365),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    customUnit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).optional(),
    endType: z.enum(TASK_RECURRENCE_END_TYPES),
    untilDate: localDateSchema.optional(),
    maxOccurrences: z.number().int().min(1).max(10_000).optional(),
  })
  .superRefine((value, context) => {
    if (value.endType === 'UNTIL_DATE' && !value.untilDate)
      context.addIssue({ code: 'custom', path: ['untilDate'], message: 'Choose an end date.' })
    if (value.endType === 'AFTER_OCCURRENCES' && !value.maxOccurrences)
      context.addIssue({
        code: 'custom',
        path: ['maxOccurrences'],
        message: 'Choose the number of occurrences.',
      })
    if (value.frequency === 'CUSTOM' && !value.customUnit)
      context.addIssue({
        code: 'custom',
        path: ['customUnit'],
        message: 'Choose an interval unit.',
      })
  })

export const taskCoreInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a task title.').max(200),
    description: z.string().trim().max(4000).optional(),
    status: z.enum(TASK_STATUSES).default('TODO'),
    priority: z.enum(TASK_PRIORITIES).default('NONE'),
    assigneeUserId: nullableId,
    listId: nullableId,
    dueDate: localDateSchema.nullable().optional(),
    dueTime: localTimeSchema.nullable().optional(),
    reminderOffsetMinutes: z.number().int().min(0).max(525_600).nullable().optional(),
    recurrence: taskRecurrenceInputSchema.nullable().optional(),
    tags: tagsSchema,
    sortOrder: z
      .number()
      .finite()
      .min(Number.MIN_SAFE_INTEGER)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
    relatedTransactionId: nullableId,
  })
  .superRefine((value, context) => {
    if (value.dueTime && !value.dueDate)
      context.addIssue({ code: 'custom', path: ['dueDate'], message: 'Choose a due date first.' })
    if (value.reminderOffsetMinutes != null && !value.dueDate)
      context.addIssue({ code: 'custom', path: ['dueDate'], message: 'Reminders need a due date.' })
    if (value.recurrence && !value.dueDate)
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Recurring tasks need a due date.',
      })
  })

export const createTaskSchema = z.intersection(
  z.object({ householdId: documentIdSchema, clientRequestId: documentIdSchema.optional() }),
  taskCoreInputSchema,
)

export const updateTaskSchema = z.object({
  householdId: documentIdSchema,
  taskId: documentIdSchema,
  expectedVersion: z.number().int().positive(),
  task: taskCoreInputSchema,
})

export const taskIdSchema = z.object({ householdId: documentIdSchema, taskId: documentIdSchema })

export const createTaskListSchema = z.object({
  householdId: documentIdSchema,
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(40).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
})

export const updateTaskListSchema = createTaskListSchema.extend({ taskListId: documentIdSchema })
export const taskListIdSchema = z.object({
  householdId: documentIdSchema,
  taskListId: documentIdSchema,
})

export const createSubtaskSchema = z.object({
  householdId: documentIdSchema,
  taskId: documentIdSchema,
  title: z.string().trim().min(1).max(200),
})

export const updateSubtaskSchema = z.object({
  householdId: documentIdSchema,
  taskId: documentIdSchema,
  subtaskId: documentIdSchema,
  title: z.string().trim().min(1).max(200).optional(),
  isCompleted: z.boolean().optional(),
})

export const deleteSubtaskSchema = z.object({
  householdId: documentIdSchema,
  taskId: documentIdSchema,
  subtaskId: documentIdSchema,
})

export const reorderTasksSchema = z.object({
  householdId: documentIdSchema,
  tasks: z
    .array(
      z.object({
        taskId: documentIdSchema,
        sortOrder: z.number().finite().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
        expectedVersion: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(100),
})

export const registerDeviceTokenSchema = z.object({
  householdId: documentIdSchema,
  token: z.string().trim().min(20).max(4096),
  platform: z.string().trim().min(1).max(80),
})

export const notificationSettingsSchema = z.object({
  householdId: documentIdSchema,
  dueReminders: z.boolean(),
  assignmentNotifications: z.boolean(),
  overdueReminders: z.boolean(),
})

export const taskNotificationIdSchema = z.object({
  notificationId: idSchema,
})

export type TaskCoreInput = z.infer<typeof taskCoreInputSchema>
export type TaskCoreFormInput = z.input<typeof taskCoreInputSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type CreateTaskListInput = z.infer<typeof createTaskListSchema>
export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>
