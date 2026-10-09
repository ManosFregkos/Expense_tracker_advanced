import { randomUUID } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  currencyMinorDigits,
  dateKeyInTimeZone,
  isTaskOverdue,
  normalizeSearchText,
  taskCoreInputSchema,
  taskDueAt,
  zonedDateTimeToUtc,
  type Household,
  type HouseholdTask,
  type FinancialAccount,
  type Transaction,
  type JarvisTaskAction,
} from '@family-expense-tracker/shared'
import { db } from '../firebase.js'

export function functionTool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
) {
  return {
    type: 'function',
    name,
    description,
    strict: true,
    parameters: {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  }
}
const nullableString = { type: ['string', 'null'] }
const scopeProperty = { type: 'string', enum: ['mine', 'household'] }
export const appTools = [
  functionTool(
    'get_account_balances',
    'Read active account balances. Distinguish app-calculated from bank-reported balances and report their update times. Never add different currencies or treat card balances as available cash.',
    { scope: scopeProperty },
  ),
  functionTool(
    'search_transactions',
    'Search individual transactions by merchant/description and inclusive household-local date range. Use null for unspecified filters. Results are bounded and are NOT spending totals; disclose truncated results.',
    {
      search: nullableString,
      startDate: nullableString,
      endDate: nullableString,
      scope: scopeProperty,
    },
  ),
  functionTool(
    'list_tasks',
    'Read open tasks, tasks due today, or overdue tasks. mine means assigned to the signed-in member; household includes all assignees. Search title/description, use null for no search. Returns real IDs; disclose truncated results.',
    {
      filter: { type: 'string', enum: ['open', 'today', 'overdue'] },
      scope: scopeProperty,
      search: nullableString,
    },
  ),
  functionTool(
    'get_task_options',
    'Read active task lists and household members before proposing task assignment or a list.',
    {},
  ),
  functionTool(
    'draft_task_create',
    'Prepare ONE new task only after an explicit request. Never saves. The user must press Confirm task change. Use null for unspecified dates, times, assignee or list; never invent IDs. New tasks have no recurrence or reminder; these can be configured in Tasks.',
    {
      title: { type: 'string' },
      dueDate: nullableString,
      dueTime: nullableString,
      priority: { type: 'string', enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      assigneeUserId: nullableString,
      listId: nullableString,
    },
  ),
  functionTool(
    'draft_task_complete',
    'Prepare completion of ONE specific open task using its real ID from list_tasks. Ask which task if ambiguous. User must confirm; never claim it is completed. Recurring completion can create the next occurrence.',
    { taskId: { type: 'string' } },
  ),
  functionTool(
    'draft_task_reschedule',
    'Prepare a new due date/time for ONE open task using a real ID from list_tasks. Preserve all other fields. Requires confirmation. Use null to remove due date/time; cannot remove a date from a recurring task or a task with reminders.',
    {
      taskId: { type: 'string' },
      dueDate: nullableString,
      dueTime: nullableString,
    },
  ),
]
const id = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => !value.includes('/'))
const scope = z.enum(['mine', 'household'])
const searchText = z.string().trim().min(1).max(200).nullable()
const date = z.iso.date().nullable()
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
const iso = (value: HouseholdTask['updatedAt'] | undefined) =>
  value ? (value instanceof Date ? value : value.toDate()).toISOString() : null

// The caller authenticates household membership before constructing this executor.
// Every path uses that authorized household, never an ID supplied by the model.
export function createAppToolExecutor(
  householdId: string,
  uid: string,
  household: Household,
  now = new Date(),
) {
  let action: JarvisTaskAction | null = null
  const root = `households/${householdId}`
  const today = dateKeyInTimeZone(now, household.timeZone)
  const taskSummary = (task: HouseholdTask, taskId: string) => ({
    id: taskId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    assigneeUserId: task.assigneeUserId ?? null,
    assignee: task.assigneeDisplayName ?? null,
    recurring: Boolean(task.recurrence),
    overdue: isTaskOverdue(task, now, household.timeZone),
  })
  const propose = (value: JarvisTaskAction) => {
    if (action)
      return {
        error: 'Only one task change per answer. Confirm or cancel before requesting another.',
      }
    action = value
    return {
      status: 'confirmation_required',
      saved: false,
      action: value,
      nextStep: 'Press Confirm task change in the app. A spoken yes does not save it.',
    }
  }
  return {
    get action() {
      return action
    },
    async execute(name: string, args: unknown): Promise<unknown> {
      if (name === 'get_account_balances') {
        const parsed = z.object({ scope }).safeParse(args)
        if (!parsed.success) return { error: 'Choose mine or household scope.' }
        const snapshot = await db.collection(`${root}/accounts`).get()
        const accounts = snapshot.docs
          .map((doc) => ({ id: doc.id, value: doc.data() as FinancialAccount }))
          .filter(
            ({ value }) =>
              !value.isArchived && (parsed.data.scope !== 'mine' || value.ownerUserId === uid),
          )
        return {
          scope: parsed.data.scope,
          accounts: accounts.slice(0, 50).map(({ id, value }) => ({
            id,
            name: value.name,
            type: value.type,
            currency: value.currency,
            currencyMinorDigits: currencyMinorDigits(value.currency),
            appCalculatedBalanceMinor: value.appCalculatedBalanceMinor ?? value.currentBalanceMinor,
            appUpdatedAt: iso(value.updatedAt),
            bankReportedBalance: value.bankReportedBalance
              ? {
                  ...value.bankReportedBalance,
                  reportedAt: iso(value.bankReportedBalance.reportedAt),
                  currencyMinorDigits: currencyMinorDigits(value.bankReportedBalance.currency),
                }
              : null,
          })),
          truncated: accounts.length > 50,
        }
      }
      if (name === 'search_transactions') {
        const parsed = z
          .object({ search: searchText, startDate: date, endDate: date, scope })
          .safeParse(args)
        if (!parsed.success) return { error: 'Use valid dates (YYYY-MM-DD), search and scope.' }
        const value = parsed.data
        if (value.startDate && value.endDate && value.startDate > value.endDate)
          return { error: 'Start date must not follow end date.' }
        let query = db
          .collection(`${root}/transactions`)
          .where('isDeleted', '==', false)
          .orderBy('transactionDate', 'desc')
        if (value.startDate)
          query = query.where(
            'transactionDate',
            '>=',
            Timestamp.fromDate(zonedDateTimeToUtc(value.startDate, '00:00', household.timeZone)),
          )
        if (value.endDate)
          query = query.where(
            'transactionDate',
            '<=',
            Timestamp.fromDate(taskDueAt(value.endDate, null, household.timeZone)),
          )
        const search = normalizeSearchText(value.search ?? '')
        const token = search.split(' ')[0]?.slice(0, 20)
        if (token) query = query.where('searchPrefixes', 'array-contains', token)
        const snapshot = await query.limit(301).get()
        const matches = snapshot.docs
          .slice(0, 300)
          .map((doc) => ({ id: doc.id, value: doc.data() as Transaction }))
          .filter(
            ({ value: t }) =>
              !t.isDeleted &&
              (t.type === 'EXPENSE' || t.type === 'INCOME') &&
              (value.scope !== 'mine' || t.ownerUserId === uid) &&
              (!search ||
                normalizeSearchText(`${t.merchant ?? ''} ${t.description}`).includes(search)),
          )
        return {
          scope: value.scope,
          timeZone: household.timeZone,
          startDate: value.startDate,
          endDate: value.endDate,
          transactions: matches.slice(0, 20).map(({ id, value: t }) => ({
            id,
            type: t.type,
            description: t.description,
            merchant: t.merchant ?? null,
            date: dateKeyInTimeZone(
              t.transactionDate instanceof Date ? t.transactionDate : t.transactionDate.toDate(),
              household.timeZone,
            ),
            amountMinor: t.amountMinor,
            currency: t.currency,
            currencyMinorDigits: currencyMinorDigits(t.currency),
          })),
          truncated: snapshot.docs.length > 300 || matches.length > 20,
          warning:
            'These are individual results, not a complete spending total. Narrow dates/search when truncated.',
        }
      }
      if (name === 'list_tasks') {
        const parsed = z
          .object({ filter: z.enum(['open', 'today', 'overdue']), scope, search: searchText })
          .safeParse(args)
        if (!parsed.success) return { error: 'Choose open, today or overdue tasks and a scope.' }
        const value = parsed.data
        let query = db
          .collection(`${root}/tasks`)
          .where('isDeleted', '==', false)
          .where('status', 'in', ['TODO', 'IN_PROGRESS'])
        if (value.filter === 'open') query = query.orderBy('updatedAt', 'desc')
        else {
          query = query.orderBy('dueAt')
          if (value.scope === 'mine') query = query.where('assigneeUserId', '==', uid)
          if (value.filter === 'today')
            query = query
              .where(
                'dueAt',
                '>=',
                Timestamp.fromDate(zonedDateTimeToUtc(today, '00:00', household.timeZone)),
              )
              .where('dueAt', '<=', Timestamp.fromDate(taskDueAt(today, null, household.timeZone)))
          else query = query.where('dueAt', '<', Timestamp.fromDate(now))
        }
        const snapshot = await query.limit(201).get()
        const search = normalizeSearchText(value.search ?? '')
        const matches = snapshot.docs
          .slice(0, 200)
          .map((doc) => ({ id: doc.id, value: doc.data() as HouseholdTask }))
          .filter(
            ({ value: t }) =>
              !t.isDeleted &&
              t.status !== 'DONE' &&
              t.status !== 'CANCELLED' &&
              (value.scope !== 'mine' || t.assigneeUserId === uid) &&
              (!search ||
                normalizeSearchText(`${t.title} ${t.description ?? ''}`).includes(search)) &&
              (value.filter !== 'overdue' || isTaskOverdue(t, now, household.timeZone)),
          )
        return {
          today,
          timeZone: household.timeZone,
          scope: value.scope,
          filter: value.filter,
          tasks: matches.slice(0, 30).map(({ id, value }) => taskSummary(value, id)),
          truncated: snapshot.docs.length > 200 || matches.length > 30,
        }
      }
      if (name === 'get_task_options') {
        const [lists, members] = await Promise.all([
          db.collection(`${root}/taskLists`).get(),
          db.collection(`${root}/members`).get(),
        ])
        return {
          signedInUserId: uid,
          lists: lists.docs
            .filter((doc) => !doc.get('isArchived'))
            .map((doc) => ({ id: doc.id, name: doc.get('name') as string })),
          members: members.docs.map((doc) => ({
            id: doc.id,
            name: doc.get('displayName') as string,
          })),
        }
      }
      if (name === 'draft_task_create') {
        const parsed = z
          .object({
            title: z.string().trim().min(1).max(200),
            dueDate: date,
            dueTime: time,
            priority: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']),
            assigneeUserId: id.nullable(),
            listId: id.nullable(),
          })
          .strict()
          .safeParse(args)
        if (!parsed.success) return { error: 'Invalid task details. Ask for clarification.' }
        const value = parsed.data
        let assigneeName: string | null = null
        let listName: string | null = null
        if (value.assigneeUserId) {
          const member = await db.doc(`${root}/members/${value.assigneeUserId}`).get()
          if (!member.exists) return { error: 'Choose a member of this household.' }
          assigneeName = member.get('displayName') as string
        }
        if (value.listId) {
          const list = await db.doc(`${root}/taskLists/${value.listId}`).get()
          if (!list.exists || list.get('isArchived'))
            return { error: 'Choose an active task list.' }
          listName = list.get('name') as string
        }
        const task = taskCoreInputSchema.safeParse(value)
        if (!task.success) return { error: 'A time requires a due date.' }
        return propose({
          kind: 'create',
          clientRequestId: `jarvis_${randomUUID()}`,
          task: task.data,
          assigneeName,
          listName,
        })
      }
      if (name === 'draft_task_complete' || name === 'draft_task_reschedule') {
        const schema =
          name === 'draft_task_complete'
            ? z.object({ taskId: id }).strict()
            : z.object({ taskId: id, dueDate: date, dueTime: time }).strict()
        const parsed = schema.safeParse(args)
        if (!parsed.success) return { error: 'Use a real task ID and valid date/time.' }
        const snapshot = await db.doc(`${root}/tasks/${parsed.data.taskId}`).get()
        const task = snapshot.data() as HouseholdTask | undefined
        if (!task || task.isDeleted) return { error: 'Task not found in this household.' }
        if (task.status === 'DONE' || task.status === 'CANCELLED')
          return { error: 'This task is already closed. Reopen it in Tasks first.' }
        if (name === 'draft_task_complete')
          return propose({
            kind: 'complete',
            taskId: snapshot.id,
            title: task.title,
            expectedVersion: task.version,
            recurring: Boolean(task.recurrence),
          })
        const dates = z.object({ dueDate: date, dueTime: time }).parse(args)
        const replacement = taskCoreInputSchema.safeParse({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assigneeUserId: task.assigneeUserId,
          listId: task.listId,
          dueDate: dates.dueDate,
          dueTime: dates.dueTime,
          reminderOffsetMinutes: task.reminderOffsetMinutes ?? null,
          recurrence: task.recurrence
            ? {
                ...task.recurrence,
                untilDate:
                  task.recurrence.untilDateKey ??
                  (task.recurrence.untilDate
                    ? dateKeyInTimeZone(
                        task.recurrence.untilDate instanceof Date
                          ? task.recurrence.untilDate
                          : task.recurrence.untilDate.toDate(),
                        household.timeZone,
                      )
                    : undefined),
              }
            : null,
          tags: task.tags,
          sortOrder: task.sortOrder,
          relatedTransactionId: task.relatedTransactionId,
        })
        if (!replacement.success)
          return {
            error: 'Invalid schedule. Recurrence/reminders need a date and a time needs a date.',
          }
        return propose({
          kind: 'reschedule',
          taskId: snapshot.id,
          expectedVersion: task.version,
          task: replacement.data,
          previousDueDate: task.dueDate ?? null,
          previousDueTime: task.dueTime ?? null,
        })
      }
      return undefined
    },
  }
}
