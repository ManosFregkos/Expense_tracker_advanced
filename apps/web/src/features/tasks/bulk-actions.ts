import type { HouseholdTask, TaskCoreInput } from '@family-expense-tracker/shared'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'

export type TaskBulkAction =
  | { type: 'complete' }
  | { type: 'assign'; assigneeUserId: string | null }
  | { type: 'reschedule'; dueDate: string; dueTime?: string | null }

function editableValues(task: HouseholdTask): TaskCoreInput {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assigneeUserId: task.assigneeUserId ?? null,
    listId: task.listId ?? null,
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    reminderOffsetMinutes: task.reminderOffsetMinutes ?? null,
    recurrence: task.recurrence
      ? {
          frequency: task.recurrence.frequency,
          interval: task.recurrence.interval,
          endType: task.recurrence.endType,
          ...(task.recurrence.daysOfWeek ? { daysOfWeek: task.recurrence.daysOfWeek } : {}),
          ...(task.recurrence.customUnit ? { customUnit: task.recurrence.customUnit } : {}),
          ...(task.recurrence.untilDateKey ? { untilDate: task.recurrence.untilDateKey } : {}),
          ...(task.recurrence.maxOccurrences
            ? { maxOccurrences: task.recurrence.maxOccurrences }
            : {}),
        }
      : null,
    tags: task.tags,
    sortOrder: task.sortOrder,
    relatedTransactionId: task.relatedTransactionId ?? null,
  }
}

export async function runTaskBulkAction(
  householdId: string,
  tasks: HouseholdTask[],
  action: TaskBulkAction,
  onProgress?: (processed: number) => void,
) {
  const succeededIds: string[] = []
  const failures: Array<{ taskId: string; title: string; message: string }> = []
  let nextIndex = 0
  let processed = 0
  async function worker() {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex++]!
      try {
        if (task.status !== 'TODO' && task.status !== 'IN_PROGRESS')
          throw new Error('Only open tasks can be updated. Refresh the list and try again.')
        if (action.type === 'complete') {
          await api.completeTask({ householdId, taskId: task.id })
        } else {
          const values = editableValues(task)
          if (action.type === 'assign') values.assigneeUserId = action.assigneeUserId
          else {
            values.dueDate = action.dueDate
            if (action.dueTime !== undefined) values.dueTime = action.dueTime
          }
          await api.updateTask({
            householdId,
            taskId: task.id,
            expectedVersion: task.version,
            task: values,
          })
        }
        succeededIds.push(task.id)
      } catch (error) {
        failures.push({ taskId: task.id, title: task.title, message: friendlyError(error) })
      }
      onProgress?.(++processed)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, worker))
  return { succeededIds, failures }
}
