import { FirebaseError } from 'firebase/app'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HouseholdTask } from '@family-expense-tracker/shared'
import { api } from '../../lib/callables'
import { runTaskBulkAction } from './bulk-actions'

vi.mock('../../lib/callables', () => ({
  api: { completeTask: vi.fn(async () => ({})), updateTask: vi.fn(async () => ({})) },
}))
const date = new Date('2026-10-02T12:00:00Z')
const task = {
  id: 't1',
  householdId: 'h1',
  title: 'Cleaning',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  assigneeUserId: 'u1',
  listId: 'home',
  dueDate: '2026-10-02',
  dueTime: '09:30',
  reminderOffsetMinutes: 60,
  tags: ['weekly'],
  sortOrder: 1000,
  version: 4,
  recurrence: {
    frequency: 'WEEKLY',
    interval: 1,
    endType: 'UNTIL_DATE',
    untilDateKey: '2026-12-31',
  },
  relatedTransactionId: 'transaction1',
  createdAt: date,
  updatedAt: date,
} as HouseholdTask
beforeEach(() => vi.clearAllMocks())

describe('bulk task actions', () => {
  it('assigns using the original version and preserves other fields and recurrence', async () => {
    const result = await runTaskBulkAction('h1', [task], { type: 'assign', assigneeUserId: null })
    expect(result).toEqual({ succeededIds: ['t1'], failures: [] })
    expect(api.updateTask).toHaveBeenCalledWith({
      householdId: 'h1',
      taskId: 't1',
      expectedVersion: 4,
      task: expect.objectContaining({
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assigneeUserId: null,
        dueDate: '2026-10-02',
        dueTime: '09:30',
        reminderOffsetMinutes: 60,
        tags: ['weekly'],
        listId: 'home',
        relatedTransactionId: 'transaction1',
        recurrence: {
          frequency: 'WEEKLY',
          interval: 1,
          endType: 'UNTIL_DATE',
          untilDate: '2026-12-31',
        },
      }),
    })
  })

  it('preserves each time when rescheduling and allows a common time or all-day override', async () => {
    await runTaskBulkAction('h1', [task], { type: 'reschedule', dueDate: '2026-10-10' })
    expect(api.updateTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          dueDate: '2026-10-10',
          dueTime: '09:30',
          reminderOffsetMinutes: 60,
        }),
      }),
    )
    await runTaskBulkAction('h1', [task], {
      type: 'reschedule',
      dueDate: '2026-10-10',
      dueTime: '18:00',
    })
    expect(api.updateTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ task: expect.objectContaining({ dueTime: '18:00' }) }),
    )
    await runTaskBulkAction('h1', [task], {
      type: 'reschedule',
      dueDate: '2026-10-10',
      dueTime: null,
    })
    expect(api.updateTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ task: expect.objectContaining({ dueTime: null }) }),
    )
  })

  it('continues after a conflict and reports successes, failed tasks, and progress', async () => {
    vi.mocked(api.updateTask).mockRejectedValueOnce(
      new FirebaseError('functions/aborted', 'Conflict'),
    )
    const progress = vi.fn()
    const result = await runTaskBulkAction(
      'h1',
      [task, { ...task, id: 't2' }],
      { type: 'assign', assigneeUserId: 'u2' },
      progress,
    )
    expect(result.succeededIds).toEqual(['t2'])
    expect(result.failures).toEqual([
      {
        taskId: 't1',
        title: 'Cleaning',
        message: 'This item changed in another session. Refresh and try again.',
      },
    ])
    expect(progress).toHaveBeenLastCalledWith(2)
  })

  it('completes through the existing recurrence-aware endpoint and skips closed tasks', async () => {
    const result = await runTaskBulkAction(
      'h1',
      [task, { ...task, id: 'closed', status: 'DONE' }],
      { type: 'complete' },
    )
    expect(api.completeTask).toHaveBeenCalledExactlyOnceWith({ householdId: 'h1', taskId: 't1' })
    expect(result.succeededIds).toEqual(['t1'])
    expect(result.failures[0]?.taskId).toBe('closed')
    expect(api.updateTask).not.toHaveBeenCalled()
  })
})
