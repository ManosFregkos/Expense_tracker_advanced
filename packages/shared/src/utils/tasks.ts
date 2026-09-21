import type { HouseholdTask, StoredDate, TaskPriority, TaskRecurrence } from '../domain/types.js'

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
}

function dateFrom(value: StoredDate): Date {
  return value instanceof Date ? value : value.toDate()
}

function dateParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  )
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = dateParts(date, timeZone)
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** Converts a household-local wall-clock time to UTC without relying on the host machine timezone. */
export function zonedDateTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (![year, month, day, hour, minute].every(Number.isFinite))
    throw new Error('Invalid local date')
  const desired = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0, 0)
  let candidate = desired
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = dateParts(new Date(candidate), timeZone)
    const observedUtc = Date.UTC(
      observed.year!,
      observed.month! - 1,
      observed.day!,
      observed.hour!,
      observed.minute!,
      observed.second!,
    )
    const delta = desired - observedUtc
    candidate += delta
    if (delta === 0) return new Date(candidate)
  }
  // A local time can be skipped by a DST jump. In that case choose the first valid minute after it.
  const target = `${dateKey}T${time}`
  for (let offset = 0; offset <= 180; offset += 1) {
    const test = new Date(candidate + offset * 60_000)
    const local = dateParts(test, timeZone)
    const localKey = `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`
    if (localKey >= target) return test
  }
  return new Date(candidate)
}

export function taskDueAt(
  dateKey: string,
  time: string | null | undefined,
  timeZone: string,
): Date {
  if (time) return zonedDateTimeToUtc(dateKey, time, timeZone)
  return new Date(zonedDateTimeToUtc(addDays(dateKey, 1), '00:00', timeZone).getTime() - 1)
}

export function isTaskOverdue(
  task: Pick<HouseholdTask, 'status' | 'dueDate' | 'dueTime' | 'dueAt' | 'isDeleted'>,
  now = new Date(),
  timeZone = 'UTC',
): boolean {
  if (task.isDeleted || task.status === 'DONE' || task.status === 'CANCELLED' || !task.dueDate)
    return false
  if (!task.dueTime) return task.dueDate < dateKeyInTimeZone(now, timeZone)
  return Boolean(task.dueAt && dateFrom(task.dueAt).getTime() < now.getTime())
}

export function isTaskDueToday(
  task: Pick<HouseholdTask, 'dueDate' | 'isDeleted'>,
  now = new Date(),
  timeZone = 'UTC',
): boolean {
  return !task.isDeleted && task.dueDate === dateKeyInTimeZone(now, timeZone)
}

export function compareTaskPriority(left: TaskPriority, right: TaskPriority): number {
  return PRIORITY_WEIGHT[right] - PRIORITY_WEIGHT[left]
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10)
}

function addMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const target = new Date(Date.UTC(year!, month! - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day!, lastDay))
  return target.toISOString().slice(0, 10)
}

export function nextTaskRecurrenceDate(
  currentDate: string,
  recurrence: Pick<
    TaskRecurrence,
    | 'frequency'
    | 'interval'
    | 'daysOfWeek'
    | 'customUnit'
    | 'endType'
    | 'untilDateKey'
    | 'maxOccurrences'
  >,
  nextOccurrenceNumber: number,
): string | null {
  if (
    recurrence.endType === 'AFTER_OCCURRENCES' &&
    nextOccurrenceNumber > (recurrence.maxOccurrences ?? 0)
  )
    return null
  let next: string
  if (recurrence.frequency === 'DAILY') next = addDays(currentDate, recurrence.interval)
  else if (recurrence.frequency === 'WEEKLY' && recurrence.daysOfWeek?.length) {
    const allowed = new Set(recurrence.daysOfWeek)
    let candidate = currentDate
    do candidate = addDays(candidate, 1)
    while (!allowed.has(new Date(`${candidate}T12:00:00Z`).getUTCDay()))
    next = candidate
  } else if (recurrence.frequency === 'WEEKLY') next = addDays(currentDate, 7 * recurrence.interval)
  else if (recurrence.frequency === 'MONTHLY') next = addMonths(currentDate, recurrence.interval)
  else if (recurrence.frequency === 'YEARLY')
    next = addMonths(currentDate, 12 * recurrence.interval)
  else {
    const unit = recurrence.customUnit ?? 'DAY'
    next =
      unit === 'DAY'
        ? addDays(currentDate, recurrence.interval)
        : unit === 'WEEK'
          ? addDays(currentDate, recurrence.interval * 7)
          : addMonths(currentDate, recurrence.interval * (unit === 'YEAR' ? 12 : 1))
  }
  if (recurrence.endType === 'UNTIL_DATE' && next > (recurrence.untilDateKey ?? '')) return null
  return next
}

export function taskReminderAt(dueAt: Date, offsetMinutes: number | null | undefined): Date | null {
  return offsetMinutes == null ? null : new Date(dueAt.getTime() - offsetMinutes * 60_000)
}

export function taskReminderStatesAfterRestore(
  task: Pick<HouseholdTask, 'status' | 'reminderAt' | 'dueAt'>,
  now = new Date(),
): {
  reminderState: 'PENDING' | 'CANCELLED' | null
  overdueReminderState: 'PENDING' | 'CANCELLED' | null
} {
  const active = task.status !== 'DONE' && task.status !== 'CANCELLED'
  const reminderPending =
    active && task.reminderAt && dateFrom(task.reminderAt).getTime() > now.getTime()
  return {
    reminderState: task.reminderAt ? (reminderPending ? 'PENDING' : 'CANCELLED') : null,
    overdueReminderState: task.dueAt ? (active ? 'PENDING' : 'CANCELLED') : null,
  }
}
