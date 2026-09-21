import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import {
  buildSearchPrefixes,
  createSubtaskSchema,
  createTaskListSchema,
  createTaskSchema,
  deleteSubtaskSchema,
  idSchema,
  nextTaskRecurrenceDate,
  normalizeSearchText,
  reorderTasksSchema,
  taskDueAt,
  taskIdSchema,
  taskListIdSchema,
  taskReminderAt,
  taskReminderStatesAfterRestore,
  updateSubtaskSchema,
  updateTaskListSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type Household,
  type HouseholdTask,
  type TaskActivityAction,
  type TaskCoreInput,
  type TaskList,
  type TaskRecurrence,
} from '@family-expense-tracker/shared'
import { secureCallable, type Actor } from '../callable.js'
import { db } from '../firebase.js'
import { writeAudit } from './audit.js'

const DEFAULT_TASK_LISTS = [
  { id: 'task-list-home', name: 'Home', icon: 'home' },
  { id: 'task-list-shopping', name: 'Shopping', icon: 'shopping-cart' },
  { id: 'task-list-appointments', name: 'Appointments', icon: 'calendar' },
  { id: 'task-list-bills-admin', name: 'Bills & Admin', icon: 'file-invoice' },
  { id: 'task-list-car', name: 'Car', icon: 'car' },
] as const

function taskRef(householdId: string, taskId: string) {
  return db.doc(`households/${householdId}/tasks/${taskId}`)
}

function storedToDate(value: HouseholdTask['reminderAt']): Date | null {
  if (!value) return null
  return value instanceof Date ? value : value.toDate()
}

function taskActivity(
  transaction: Transaction,
  actor: Actor,
  householdId: string,
  taskId: string,
  action: TaskActivityAction,
  metadata?: Record<string, string | number | boolean | null>,
) {
  const ref = db.collection(`households/${householdId}/taskActivity`).doc()
  transaction.set(ref, {
    id: ref.id,
    householdId,
    taskId,
    userId: actor.uid,
    userDisplayName: actor.displayName,
    action,
    timestamp: FieldValue.serverTimestamp(),
    ...(metadata ? { metadata } : {}),
  })
}

function taskAuditSnapshot(task: HouseholdTask): Record<string, unknown> {
  return {
    title: task.title,
    status: task.status,
    priority: task.priority,
    assigneeUserId: task.assigneeUserId ?? null,
    listId: task.listId ?? null,
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    recurrence: task.recurrence?.frequency ?? null,
    version: task.version,
    isDeleted: task.isDeleted,
  }
}

async function requireActorMember(
  transaction: Transaction,
  householdId: string,
  actor: Actor,
): Promise<void> {
  const member = await transaction.get(db.doc(`households/${householdId}/members/${actor.uid}`))
  if (!member.exists) throw new HttpsError('permission-denied', 'Household access denied.')
}

async function readHousehold(transaction: Transaction, householdId: string): Promise<Household> {
  const snapshot = await transaction.get(db.doc(`households/${householdId}`))
  if (!snapshot.exists) throw new HttpsError('not-found', 'Household not found.')
  return snapshot.data() as Household
}

async function validateRelations(
  transaction: Transaction,
  householdId: string,
  input: Pick<TaskCoreInput, 'assigneeUserId' | 'listId' | 'relatedTransactionId'>,
  allowArchivedListId?: string | null,
): Promise<{ assigneeDisplayName?: string; listName?: string }> {
  const [assignee, list, relatedTransaction] = await Promise.all([
    input.assigneeUserId
      ? transaction.get(db.doc(`households/${householdId}/members/${input.assigneeUserId}`))
      : null,
    input.listId
      ? transaction.get(db.doc(`households/${householdId}/taskLists/${input.listId}`))
      : null,
    input.relatedTransactionId
      ? transaction.get(
          db.doc(`households/${householdId}/transactions/${input.relatedTransactionId}`),
        )
      : null,
  ])
  if (assignee && !assignee.exists)
    throw new HttpsError('failed-precondition', 'Assignee is no longer a household member.')
  if (
    list &&
    (!list.exists || (list.get('isArchived') === true && input.listId !== allowArchivedListId))
  )
    throw new HttpsError('failed-precondition', 'Choose an active task list.')
  if (relatedTransaction && !relatedTransaction.exists)
    throw new HttpsError('failed-precondition', 'Related transaction does not exist.')
  return {
    ...(assignee ? { assigneeDisplayName: String(assignee.get('displayName') ?? 'Member') } : {}),
    ...(list ? { listName: String(list.get('name') ?? '') } : {}),
  }
}

function storedRecurrence(
  recurrence: TaskCoreInput['recurrence'],
  timeZone: string,
): TaskRecurrence | null {
  if (!recurrence) return null
  return {
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    ...(recurrence.daysOfWeek?.length
      ? { daysOfWeek: [...new Set(recurrence.daysOfWeek)].sort((a, b) => a - b) }
      : {}),
    ...(recurrence.customUnit ? { customUnit: recurrence.customUnit } : {}),
    endType: recurrence.endType,
    ...(recurrence.untilDate
      ? {
          untilDateKey: recurrence.untilDate,
          untilDate: Timestamp.fromDate(taskDueAt(recurrence.untilDate, null, timeZone)),
        }
      : {}),
    ...(recurrence.maxOccurrences ? { maxOccurrences: recurrence.maxOccurrences } : {}),
  }
}

function makeTask(
  input: CreateTaskInput,
  id: string,
  actor: Actor,
  household: Household,
  relationNames: { assigneeDisplayName?: string; listName?: string },
): HouseholdTask {
  const now = Timestamp.now()
  const dueAt = input.dueDate
    ? Timestamp.fromDate(taskDueAt(input.dueDate, input.dueTime, household.timeZone))
    : null
  const reminderAt = dueAt ? taskReminderAt(dueAt.toDate(), input.reminderOffsetMinutes) : null
  const recurrence = storedRecurrence(input.recurrence, household.timeZone)
  return {
    id,
    householdId: input.householdId,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    status: input.status,
    priority: input.priority,
    assigneeUserId: input.assigneeUserId ?? null,
    assigneeDisplayName: relationNames.assigneeDisplayName ?? null,
    listId: input.listId ?? null,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    dueAt,
    reminderAt: reminderAt ? Timestamp.fromDate(reminderAt) : null,
    reminderOffsetMinutes: input.reminderOffsetMinutes ?? null,
    reminderState:
      reminderAt && input.status !== 'DONE' && input.status !== 'CANCELLED' ? 'PENDING' : null,
    overdueReminderState:
      dueAt && input.status !== 'DONE' && input.status !== 'CANCELLED' ? 'PENDING' : null,
    recurrence,
    tags: [...new Set(input.tags.map((tag) => normalizeSearchText(tag)).filter(Boolean))],
    searchPrefixes: buildSearchPrefixes(
      input.title,
      input.description,
      relationNames.listName,
      ...input.tags,
    ),
    sortOrder: input.sortOrder ?? now.toMillis(),
    version: 1,
    seriesId: recurrence ? id : null,
    occurrenceNumber: recurrence ? 1 : null,
    relatedTransactionId: input.relatedTransactionId ?? null,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now,
    ...(input.status === 'DONE' ? { completedAt: now, completedBy: actor.uid } : {}),
    ...(input.status === 'CANCELLED' ? { cancelledAt: now, cancelledBy: actor.uid } : {}),
    isDeleted: false,
  }
}

function assignmentNotification(
  transaction: Transaction,
  task: HouseholdTask,
  actor: Actor,
  enabled: boolean,
) {
  if (!enabled || !task.assigneeUserId || task.assigneeUserId === actor.uid) return
  const id = `assigned-${task.id}-${task.version}-${task.assigneeUserId}`
  transaction.set(db.doc(`users/${task.assigneeUserId}/taskNotifications/${id}`), {
    id,
    householdId: task.householdId,
    taskId: task.id,
    title: 'Task assigned to you',
    body: task.title,
    type: 'ASSIGNED',
    createdAt: FieldValue.serverTimestamp(),
    readAt: null,
    pushState: 'PENDING',
  })
}

export const initializeTaskModule = secureCallable(
  z.object({ householdId: idSchema }),
  async (input, actor) => {
    await db.runTransaction(async (transaction) => {
      await requireActorMember(transaction, input.householdId, actor)
      const now = Timestamp.now()
      const refs = DEFAULT_TASK_LISTS.map((item) =>
        db.doc(`households/${input.householdId}/taskLists/${item.id}`),
      )
      const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)))
      snapshots.forEach((snapshot, index) => {
        if (snapshot.exists) return
        const seed = DEFAULT_TASK_LISTS[index]
        const ref = refs[index]
        if (!seed || !ref) return
        transaction.set(ref, {
          id: seed.id,
          householdId: input.householdId,
          name: seed.name,
          normalizedName: normalizeSearchText(seed.name),
          icon: seed.icon,
          sortOrder: index * 1000,
          isArchived: false,
          createdBy: actor.uid,
          createdAt: now,
          updatedAt: now,
        } satisfies TaskList)
      })
    })
    return { initialized: true }
  },
)

export const createTask = secureCallable(createTaskSchema, async (input, actor) => {
  const ref = input.clientRequestId
    ? db.doc(`households/${input.householdId}/tasks/${input.clientRequestId}`)
    : db.collection(`households/${input.householdId}/tasks`).doc()
  await db.runTransaction(async (transaction) => {
    const [household, settings, existing] = await Promise.all([
      readHousehold(transaction, input.householdId),
      transaction.get(
        db.doc(
          `users/${input.assigneeUserId ?? actor.uid}/taskNotificationSettings/${input.householdId}`,
        ),
      ),
      transaction.get(ref),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (existing.exists) return
    const names = await validateRelations(transaction, input.householdId, input)
    const task = makeTask(input, ref.id, actor, household, names)
    transaction.set(ref, task)
    taskActivity(transaction, actor, input.householdId, ref.id, 'CREATED')
    assignmentNotification(
      transaction,
      task,
      actor,
      settings.get('assignmentNotifications') === true,
    )
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: ref.id,
      after: taskAuditSnapshot(task),
    })
    if (task.recurrence)
      writeAudit(db, transaction, {
        householdId: input.householdId,
        userId: actor.uid,
        action: 'TASK_RECURRENCE_CREATED',
        entityType: 'TASK',
        entityId: ref.id,
        after: { frequency: task.recurrence.frequency, interval: task.recurrence.interval },
      })
  })
  return { taskId: ref.id }
})

export const updateTask = secureCallable(updateTaskSchema, async (input, actor) => {
  const ref = taskRef(input.householdId, input.taskId)
  await db.runTransaction(async (transaction) => {
    const [snapshot, household, settings] = await Promise.all([
      transaction.get(ref),
      readHousehold(transaction, input.householdId),
      transaction.get(
        db.doc(
          `users/${input.task.assigneeUserId ?? actor.uid}/taskNotificationSettings/${input.householdId}`,
        ),
      ),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Task not found.')
    const before = snapshot.data() as HouseholdTask
    if (before.isDeleted) throw new HttpsError('not-found', 'Task not found.')
    if (before.status === 'DONE' || before.status === 'CANCELLED')
      throw new HttpsError('failed-precondition', 'Reopen this task before editing it.')
    if (before.version !== input.expectedVersion)
      throw new HttpsError(
        'aborted',
        'This task changed in another session. Refresh and try again.',
      )
    if (input.task.status === 'DONE' || input.task.status === 'CANCELLED')
      throw new HttpsError(
        'failed-precondition',
        'Use the complete or cancel action to close a task.',
      )
    const names = await validateRelations(transaction, input.householdId, input.task, before.listId)
    const replacement = makeTask(
      { ...input.task, householdId: input.householdId },
      before.id,
      actor,
      household,
      names,
    )
    const after: HouseholdTask = {
      ...replacement,
      createdAt: before.createdAt,
      createdBy: before.createdBy,
      version: before.version + 1,
      seriesId: before.seriesId ?? replacement.seriesId ?? null,
      occurrenceNumber: before.occurrenceNumber ?? replacement.occurrenceNumber ?? null,
      previousOccurrenceId: before.previousOccurrenceId ?? null,
      nextOccurrenceId: before.nextOccurrenceId ?? null,
      ...(before.completedAt ? { completedAt: before.completedAt } : {}),
      ...(before.completedBy ? { completedBy: before.completedBy } : {}),
      ...(before.cancelledAt ? { cancelledAt: before.cancelledAt } : {}),
      ...(before.cancelledBy ? { cancelledBy: before.cancelledBy } : {}),
    }
    transaction.set(ref, after)
    taskActivity(transaction, actor, input.householdId, ref.id, 'UPDATED')
    if (before.assigneeUserId !== after.assigneeUserId) {
      taskActivity(transaction, actor, input.householdId, ref.id, 'ASSIGNED', {
        assigneeUserId: after.assigneeUserId ?? null,
      })
      assignmentNotification(
        transaction,
        after,
        actor,
        settings.get('assignmentNotifications') === true,
      )
    }
    if (before.dueDate !== after.dueDate || before.dueTime !== after.dueTime)
      taskActivity(transaction, actor, input.householdId, ref.id, 'DUE_DATE_CHANGED', {
        dueDate: after.dueDate ?? null,
        dueTime: after.dueTime ?? null,
      })
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: before.assigneeUserId !== after.assigneeUserId ? 'TASK_ASSIGNED' : 'TASK_UPDATED',
      entityType: 'TASK',
      entityId: ref.id,
      before: taskAuditSnapshot(before),
      after: taskAuditSnapshot(after),
    })
  })
  return { taskId: ref.id }
})

export const completeTask = secureCallable(taskIdSchema, async (input, actor) => {
  const ref = taskRef(input.householdId, input.taskId)
  let nextTaskId: string | null = null
  await db.runTransaction(async (transaction) => {
    const [snapshot, household] = await Promise.all([
      transaction.get(ref),
      readHousehold(transaction, input.householdId),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Task not found.')
    const before = snapshot.data() as HouseholdTask
    if (before.isDeleted) throw new HttpsError('not-found', 'Task not found.')
    if (before.status === 'CANCELLED')
      throw new HttpsError('failed-precondition', 'Reopen this task before completing it.')
    if (before.status === 'DONE') {
      nextTaskId = before.nextOccurrenceId ?? null
      return
    }
    const nextNumber = (before.occurrenceNumber ?? 1) + 1
    const nextDate =
      before.recurrence && before.dueDate
        ? nextTaskRecurrenceDate(before.dueDate, before.recurrence, nextNumber)
        : null
    const seriesId = before.seriesId ?? before.id
    const nextRef = nextDate
      ? taskRef(input.householdId, `${seriesId}__occurrence_${nextNumber}`)
      : null
    const [nextSnapshot, currentAssignee] = await Promise.all([
      nextRef ? transaction.get(nextRef) : null,
      before.assigneeUserId
        ? transaction.get(
            db.doc(`households/${input.householdId}/members/${before.assigneeUserId}`),
          )
        : null,
    ])
    const now = Timestamp.now()
    nextTaskId = nextRef?.id ?? null
    const after: HouseholdTask = {
      ...before,
      status: 'DONE',
      completedAt: now,
      completedBy: actor.uid,
      cancelledAt: null,
      cancelledBy: null,
      reminderState: before.reminderAt ? 'CANCELLED' : (before.reminderState ?? null),
      overdueReminderState: before.dueAt ? 'CANCELLED' : (before.overdueReminderState ?? null),
      nextOccurrenceId: nextTaskId,
      version: before.version + 1,
      updatedAt: now,
    }
    transaction.set(ref, after)
    if (nextRef && (!nextSnapshot?.exists || nextSnapshot.get('isDeleted') === true) && nextDate) {
      const nextDue = Timestamp.fromDate(taskDueAt(nextDate, before.dueTime, household.timeZone))
      const nextReminder = taskReminderAt(nextDue.toDate(), before.reminderOffsetMinutes)
      const nextTask: HouseholdTask = {
        ...before,
        id: nextRef.id,
        status: 'TODO',
        assigneeUserId: currentAssignee?.exists ? (before.assigneeUserId ?? null) : null,
        assigneeDisplayName: currentAssignee?.exists ? (before.assigneeDisplayName ?? null) : null,
        dueDate: nextDate,
        dueAt: nextDue,
        reminderAt: nextReminder ? Timestamp.fromDate(nextReminder) : null,
        reminderState: nextReminder ? 'PENDING' : null,
        overdueReminderState: 'PENDING',
        version: 1,
        seriesId,
        occurrenceNumber: nextNumber,
        previousOccurrenceId: before.id,
        nextOccurrenceId: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        completedBy: null,
        cancelledAt: null,
        cancelledBy: null,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      }
      transaction.set(nextRef, nextTask)
      taskActivity(transaction, actor, input.householdId, nextRef.id, 'CREATED', {
        recurring: true,
        previousOccurrenceId: before.id,
      })
    }
    taskActivity(transaction, actor, input.householdId, ref.id, 'COMPLETED')
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'TASK_COMPLETED',
      entityType: 'TASK',
      entityId: ref.id,
      before: taskAuditSnapshot(before),
      after: taskAuditSnapshot(after),
    })
  })
  return { taskId: ref.id, nextTaskId }
})

async function changeTaskState(
  input: { householdId: string; taskId: string },
  actor: Actor,
  target: 'TODO' | 'CANCELLED',
) {
  const ref = taskRef(input.householdId, input.taskId)
  await db.runTransaction(async (transaction) => {
    const [snapshot] = await Promise.all([
      transaction.get(ref),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Task not found.')
    const before = snapshot.data() as HouseholdTask
    if (before.isDeleted) throw new HttpsError('not-found', 'Task not found.')
    if (before.status === target) return
    if (target === 'TODO' && before.status === 'DONE' && before.nextOccurrenceId) {
      const generatedRef = taskRef(input.householdId, before.nextOccurrenceId)
      const [generated, generatedSubtasks] = await Promise.all([
        transaction.get(generatedRef),
        transaction.get(generatedRef.collection('subtasks').limit(1)),
      ])
      if (generated.exists && generated.get('isDeleted') !== true) {
        const pristine =
          generated.get('status') === 'TODO' &&
          generated.get('version') === 1 &&
          generated.get('reminderState') !== 'SENT' &&
          generated.get('overdueReminderState') !== 'SENT' &&
          generatedSubtasks.empty
        if (!pristine)
          throw new HttpsError(
            'failed-precondition',
            'A later recurring occurrence has activity. Reopen it instead.',
          )
        transaction.update(generatedRef, {
          isDeleted: true,
          deletedAt: Timestamp.now(),
          deletedBy: actor.uid,
          reminderState: generated.get('reminderAt') ? 'CANCELLED' : null,
          overdueReminderState: generated.get('dueAt') ? 'CANCELLED' : null,
          version: 2,
          updatedAt: Timestamp.now(),
        })
        taskActivity(transaction, actor, input.householdId, generatedRef.id, 'DELETED', {
          reason: 'previous_occurrence_reopened',
        })
      }
    }
    const now = Timestamp.now()
    const reminderPending =
      target === 'TODO' &&
      before.reminderAt &&
      (storedToDate(before.reminderAt)?.getTime() ?? 0) > now.toMillis()
    const after: HouseholdTask = {
      ...before,
      status: target,
      completedAt: null,
      completedBy: null,
      cancelledAt: target === 'CANCELLED' ? now : null,
      cancelledBy: target === 'CANCELLED' ? actor.uid : null,
      nextOccurrenceId: target === 'TODO' ? null : (before.nextOccurrenceId ?? null),
      reminderState: reminderPending ? 'PENDING' : before.reminderAt ? 'CANCELLED' : null,
      overdueReminderState:
        target === 'TODO' && before.dueAt ? 'PENDING' : before.dueAt ? 'CANCELLED' : null,
      version: before.version + 1,
      updatedAt: now,
    }
    transaction.set(ref, after)
    const action = target === 'TODO' ? 'REOPENED' : 'CANCELLED'
    taskActivity(transaction, actor, input.householdId, ref.id, action)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: target === 'TODO' ? 'TASK_REOPENED' : 'TASK_CANCELLED',
      entityType: 'TASK',
      entityId: ref.id,
      before: taskAuditSnapshot(before),
      after: taskAuditSnapshot(after),
    })
  })
  return { taskId: ref.id }
}

export const reopenTask = secureCallable(taskIdSchema, (input, actor) =>
  changeTaskState(input, actor, 'TODO'),
)
export const cancelTask = secureCallable(taskIdSchema, (input, actor) =>
  changeTaskState(input, actor, 'CANCELLED'),
)

async function setTaskDeleted(
  input: { householdId: string; taskId: string },
  actor: Actor,
  restore: boolean,
) {
  const ref = taskRef(input.householdId, input.taskId)
  await db.runTransaction(async (transaction) => {
    const [snapshot] = await Promise.all([
      transaction.get(ref),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Task not found.')
    const before = snapshot.data() as HouseholdTask
    if (before.isDeleted === !restore) return
    const now = Timestamp.now()
    const restoredReminderStates = taskReminderStatesAfterRestore(before, now.toDate())
    const after: HouseholdTask = {
      ...before,
      isDeleted: !restore,
      deletedAt: restore ? null : now,
      deletedBy: restore ? null : actor.uid,
      reminderState: restore
        ? restoredReminderStates.reminderState
        : before.reminderAt
          ? 'CANCELLED'
          : null,
      overdueReminderState:
        restore && before.dueAt
          ? restoredReminderStates.overdueReminderState
          : before.dueAt
            ? 'CANCELLED'
            : null,
      version: before.version + 1,
      updatedAt: now,
    }
    transaction.set(ref, after)
    taskActivity(transaction, actor, input.householdId, ref.id, restore ? 'RESTORED' : 'DELETED')
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: restore ? 'TASK_RESTORED' : 'TASK_DELETED',
      entityType: 'TASK',
      entityId: ref.id,
      before: taskAuditSnapshot(before),
      after: taskAuditSnapshot(after),
    })
  })
  return { taskId: ref.id }
}

export const deleteTask = secureCallable(taskIdSchema, (input, actor) =>
  setTaskDeleted(input, actor, false),
)
export const restoreTask = secureCallable(taskIdSchema, (input, actor) =>
  setTaskDeleted(input, actor, true),
)

export const createTaskList = secureCallable(createTaskListSchema, async (input, actor) => {
  const ref = db.collection(`households/${input.householdId}/taskLists`).doc()
  await db.runTransaction(async (transaction) => {
    const [lists] = await Promise.all([
      transaction.get(db.collection(`households/${input.householdId}/taskLists`)),
      requireActorMember(transaction, input.householdId, actor),
    ])
    const normalizedName = normalizeSearchText(input.name)
    if (lists.docs.some((item) => item.get('normalizedName') === normalizedName))
      throw new HttpsError('already-exists', 'A task list with this name already exists.')
    const now = Timestamp.now()
    const list: TaskList = {
      id: ref.id,
      householdId: input.householdId,
      name: input.name,
      normalizedName,
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
      sortOrder: lists.size * 1000,
      isArchived: false,
      createdBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    }
    transaction.set(ref, list)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'TASK_LIST_CREATED',
      entityType: 'TASK_LIST',
      entityId: ref.id,
      after: { name: list.name },
    })
  })
  return { taskListId: ref.id }
})

export const updateTaskList = secureCallable(updateTaskListSchema, async (input, actor) => {
  const ref = db.doc(`households/${input.householdId}/taskLists/${input.taskListId}`)
  await db.runTransaction(async (transaction) => {
    const [snapshot, lists] = await Promise.all([
      transaction.get(ref),
      transaction.get(db.collection(`households/${input.householdId}/taskLists`)),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Task list not found.')
    const normalizedName = normalizeSearchText(input.name)
    if (
      lists.docs.some((item) => item.id !== ref.id && item.get('normalizedName') === normalizedName)
    )
      throw new HttpsError('already-exists', 'A task list with this name already exists.')
    const update = {
      name: input.name,
      normalizedName,
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
      updatedAt: Timestamp.now(),
    }
    transaction.update(ref, update)
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'TASK_LIST_UPDATED',
      entityType: 'TASK_LIST',
      entityId: ref.id,
      before: { name: snapshot.get('name') as string },
      after: { name: input.name },
    })
  })
  return { taskListId: ref.id }
})

export const archiveTaskList = secureCallable(taskListIdSchema, async (input, actor) => {
  const ref = db.doc(`households/${input.householdId}/taskLists/${input.taskListId}`)
  await db.runTransaction(async (transaction) => {
    const [snapshot] = await Promise.all([
      transaction.get(ref),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!snapshot.exists) throw new HttpsError('not-found', 'Task list not found.')
    if (snapshot.get('isArchived') === true) return
    transaction.update(ref, { isArchived: true, updatedAt: Timestamp.now() })
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'TASK_LIST_ARCHIVED',
      entityType: 'TASK_LIST',
      entityId: ref.id,
      after: { isArchived: true },
    })
  })
  return { taskListId: ref.id }
})

export const createSubtask = secureCallable(createSubtaskSchema, async (input, actor) => {
  const parent = taskRef(input.householdId, input.taskId)
  const ref = parent.collection('subtasks').doc()
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, subtasks] = await Promise.all([
      transaction.get(parent),
      transaction.get(parent.collection('subtasks')),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!taskSnapshot.exists || taskSnapshot.get('isDeleted') === true)
      throw new HttpsError('not-found', 'Task not found.')
    const now = Timestamp.now()
    transaction.set(ref, {
      id: ref.id,
      householdId: input.householdId,
      taskId: input.taskId,
      title: input.title,
      isCompleted: false,
      sortOrder: subtasks.size * 1000,
      createdAt: now,
      updatedAt: now,
    })
    taskActivity(transaction, actor, input.householdId, input.taskId, 'SUBTASK_CREATED', {
      subtaskId: ref.id,
    })
    writeAudit(db, transaction, {
      householdId: input.householdId,
      userId: actor.uid,
      action: 'TASK_SUBTASK_CREATED',
      entityType: 'TASK_SUBTASK',
      entityId: ref.id,
      after: { taskId: input.taskId },
    })
  })
  return { subtaskId: ref.id }
})

export const updateSubtask = secureCallable(updateSubtaskSchema, async (input, actor) => {
  const parent = taskRef(input.householdId, input.taskId)
  const ref = parent.collection('subtasks').doc(input.subtaskId)
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, snapshot] = await Promise.all([
      transaction.get(parent),
      transaction.get(ref),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!taskSnapshot.exists || taskSnapshot.get('isDeleted') === true)
      throw new HttpsError('not-found', 'Task not found.')
    if (!snapshot.exists) throw new HttpsError('not-found', 'Subtask not found.')
    const wasCompleted = snapshot.get('isCompleted') === true
    const isCompleted = input.isCompleted ?? wasCompleted
    const existingCompletedAt = snapshot.get('completedAt') as Timestamp | undefined
    const existingCompletedBy = snapshot.get('completedBy') as string | undefined
    const update = {
      ...(input.title ? { title: input.title } : {}),
      isCompleted,
      completedAt: isCompleted ? (existingCompletedAt ?? Timestamp.now()) : null,
      completedBy: isCompleted ? (existingCompletedBy ?? actor.uid) : null,
      updatedAt: Timestamp.now(),
    }
    transaction.update(ref, update)
    taskActivity(
      transaction,
      actor,
      input.householdId,
      input.taskId,
      wasCompleted !== isCompleted && isCompleted ? 'SUBTASK_COMPLETED' : 'SUBTASK_UPDATED',
      { subtaskId: ref.id },
    )
    if (wasCompleted !== isCompleted)
      writeAudit(db, transaction, {
        householdId: input.householdId,
        userId: actor.uid,
        action: 'TASK_SUBTASK_COMPLETED',
        entityType: 'TASK_SUBTASK',
        entityId: ref.id,
        after: { taskId: input.taskId, isCompleted },
      })
  })
  return { subtaskId: ref.id }
})

export const deleteSubtask = secureCallable(deleteSubtaskSchema, async (input, actor) => {
  const parent = taskRef(input.householdId, input.taskId)
  const ref = parent.collection('subtasks').doc(input.subtaskId)
  await db.runTransaction(async (transaction) => {
    const [taskSnapshot, snapshot] = await Promise.all([
      transaction.get(parent),
      transaction.get(ref),
      requireActorMember(transaction, input.householdId, actor),
    ])
    if (!taskSnapshot.exists || taskSnapshot.get('isDeleted') === true)
      throw new HttpsError('not-found', 'Task not found.')
    if (!snapshot.exists) return
    transaction.delete(ref)
    taskActivity(transaction, actor, input.householdId, input.taskId, 'SUBTASK_UPDATED', {
      subtaskId: ref.id,
      deleted: true,
    })
  })
  return { subtaskId: ref.id }
})

export const reorderTasks = secureCallable(reorderTasksSchema, async (input, actor) => {
  await db.runTransaction(async (transaction) => {
    const refs = input.tasks.map((item) => taskRef(input.householdId, item.taskId))
    const snapshots = await Promise.all([
      ...refs.map((ref) => transaction.get(ref)),
      requireActorMember(transaction, input.householdId, actor),
    ])
    input.tasks.forEach((item, index) => {
      const snapshot = snapshots[index]
      const ref = refs[index]
      if (!snapshot || !('exists' in snapshot) || !snapshot.exists || !ref)
        throw new HttpsError('not-found', 'A reordered task no longer exists.')
      const task = snapshot.data() as HouseholdTask
      if (task.isDeleted) throw new HttpsError('not-found', 'A reordered task no longer exists.')
      if (task.version !== item.expectedVersion)
        throw new HttpsError('aborted', 'Task order changed in another session. Refresh and retry.')
      transaction.update(ref, {
        sortOrder: item.sortOrder,
        version: task.version + 1,
        updatedAt: Timestamp.now(),
      })
    })
  })
  return { reordered: input.tasks.length }
})

export const taskServiceInternals = {
  DEFAULT_TASK_LISTS,
  makeTask,
  storedRecurrence,
}
