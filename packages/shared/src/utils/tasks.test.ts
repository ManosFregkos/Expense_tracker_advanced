import { describe, expect, it } from 'vitest'
import {
  compareTaskPriority,
  createTaskSchema,
  dateKeyInTimeZone,
  isTaskOverdue,
  nextTaskRecurrenceDate,
  taskDueAt,
  taskReminderAt,
  taskReminderStatesAfterRestore,
  zonedDateTimeToUtc,
  type HouseholdTask,
} from '../index.js'

function task(overrides: Partial<HouseholdTask> = {}): HouseholdTask {
  const now = new Date('2026-09-21T10:00:00Z')
  return {
    id: 'task-1',
    householdId: 'household-1',
    title: 'Task',
    status: 'TODO',
    priority: 'NONE',
    tags: [],
    searchPrefixes: [],
    sortOrder: 0,
    version: 1,
    createdBy: 'user-1',
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    ...overrides,
  }
}

describe('household task dates', () => {
  it('keeps a date-only deadline in the household day through midnight', () => {
    const dueAt = taskDueAt('2026-09-21', null, 'Europe/Athens')
    expect(dateKeyInTimeZone(dueAt, 'Europe/Athens')).toBe('2026-09-21')
    expect(
      isTaskOverdue(
        task({ dueDate: '2026-09-21', dueAt }),
        new Date('2026-09-21T20:30:00Z'),
        'Europe/Athens',
      ),
    ).toBe(false)
    expect(
      isTaskOverdue(
        task({ dueDate: '2026-09-21', dueAt }),
        new Date('2026-09-21T21:00:00Z'),
        'Europe/Athens',
      ),
    ).toBe(true)
  })

  it('treats a timed task as overdue only after the exact instant', () => {
    const dueAt = zonedDateTimeToUtc('2026-09-21', '00:00', 'Europe/Athens')
    const value = task({ dueDate: '2026-09-21', dueTime: '00:00', dueAt })
    expect(isTaskOverdue(value, dueAt, 'Europe/Athens')).toBe(false)
    expect(isTaskOverdue(value, new Date(dueAt.getTime() + 1), 'Europe/Athens')).toBe(true)
  })

  it('does not move a DST-boundary local date to another day', () => {
    const dueAt = taskDueAt('2026-03-29', null, 'Europe/Athens')
    expect(dateKeyInTimeZone(dueAt, 'Europe/Athens')).toBe('2026-03-29')
    expect(taskReminderAt(dueAt, 60)?.getTime()).toBe(dueAt.getTime() - 3_600_000)
  })

  it('re-arms only active restored task reminders', () => {
    const now = new Date('2026-09-21T10:00:00Z')
    const future = new Date('2026-09-21T11:00:00Z')
    const due = new Date('2026-09-21T12:00:00Z')
    expect(taskReminderStatesAfterRestore(task({ reminderAt: future, dueAt: due }), now)).toEqual({
      reminderState: 'PENDING',
      overdueReminderState: 'PENDING',
    })
    expect(
      taskReminderStatesAfterRestore(task({ status: 'DONE', reminderAt: future, dueAt: due }), now),
    ).toEqual({ reminderState: 'CANCELLED', overdueReminderState: 'CANCELLED' })
  })
})

describe('task recurrence', () => {
  it.each([
    ['DAILY', 1, '2026-09-22'],
    ['WEEKLY', 1, '2026-09-28'],
    ['MONTHLY', 1, '2026-10-21'],
    ['YEARLY', 1, '2027-09-21'],
    ['CUSTOM', 3, '2026-12-21'],
  ] as const)('advances %s recurrence deterministically', (frequency, interval, expected) => {
    expect(
      nextTaskRecurrenceDate(
        '2026-09-21',
        {
          frequency,
          interval,
          ...(frequency === 'CUSTOM' ? { customUnit: 'MONTH' as const } : {}),
          endType: 'NEVER',
        },
        2,
      ),
    ).toBe(expected)
  })

  it('clamps monthly recurrence and respects occurrence and date endings', () => {
    expect(
      nextTaskRecurrenceDate(
        '2026-01-31',
        { frequency: 'MONTHLY', interval: 1, endType: 'NEVER' },
        2,
      ),
    ).toBe('2026-02-28')
    expect(
      nextTaskRecurrenceDate(
        '2026-01-31',
        { frequency: 'MONTHLY', interval: 1, endType: 'AFTER_OCCURRENCES', maxOccurrences: 1 },
        2,
      ),
    ).toBeNull()
    expect(
      nextTaskRecurrenceDate(
        '2026-01-31',
        { frequency: 'MONTHLY', interval: 1, endType: 'UNTIL_DATE', untilDateKey: '2026-02-20' },
        2,
      ),
    ).toBeNull()
  })
})

describe('task validation and sorting', () => {
  it('rejects path-like IDs and reminders without a due date', () => {
    expect(
      createTaskSchema.safeParse({ householdId: 'a/b', title: 'Task', tags: [] }).success,
    ).toBe(false)
    expect(
      createTaskSchema.safeParse({
        householdId: 'h1',
        title: 'Task',
        tags: [],
        reminderOffsetMinutes: 10,
      }).success,
    ).toBe(false)
    expect(
      createTaskSchema.safeParse({
        householdId: 'h1',
        title: 'Editable task',
        tags: [],
        sortOrder: Date.now(),
      }).success,
    ).toBe(true)
  })

  it('sorts urgent priorities before lower priorities', () => {
    expect(compareTaskPriority('URGENT', 'LOW')).toBeLessThan(0)
    expect(compareTaskPriority('NONE', 'HIGH')).toBeGreaterThan(0)
  })
})
