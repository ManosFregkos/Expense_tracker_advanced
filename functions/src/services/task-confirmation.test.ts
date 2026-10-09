import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { completeTask, createTask } from './tasks.js'

const store = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  writes: [] as string[],
}))
vi.mock('../firebase.js', () => {
  const ref = (path: string) => ({ path, id: path.split('/').at(-1)! })
  return {
    db: {
      doc: ref,
      collection: (path: string) => ({ doc: () => ref(`${path}/generated`) }),
      runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          get: async (reference: { path: string }) => ({
            exists: store.documents.has(reference.path),
            data: () => store.documents.get(reference.path),
            get: (key: string) => store.documents.get(reference.path)?.[key],
          }),
          set: (reference: { path: string }, value: Record<string, unknown>) => {
            store.writes.push(reference.path)
            store.documents.set(reference.path, value)
          },
        }),
    },
  }
})
vi.mock('./audit.js', () => ({ writeAudit: vi.fn() }))
const request = (data: unknown) =>
  ({
    data,
    auth: { uid: 'u1', token: { email_verified: true, email: 'member@example.test' } },
  }) as Parameters<typeof completeTask.run>[0]
beforeEach(() => {
  store.documents.clear()
  store.writes = []
  store.documents.set('households/h1', {
    id: 'h1',
    timeZone: 'Europe/Athens',
    defaultCurrency: 'EUR',
  })
  store.documents.set('households/h1/members/u1', { displayName: 'Manos' })
  store.documents.set('households/h1/tasks/t1', {
    id: 't1',
    householdId: 'h1',
    title: 'Buy milk',
    status: 'TODO',
    priority: 'NONE',
    isDeleted: false,
    version: 4,
    dueDate: '2026-10-10',
    tags: [],
    sortOrder: 1,
    createdBy: 'u1',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    recurrence: { frequency: 'DAILY', interval: 1, endType: 'NEVER' },
    seriesId: 't1',
    occurrenceNumber: 1,
  })
})
describe('confirmed task writes', () => {
  it('rejects a stale completion preview before changing the task or creating a recurring occurrence', async () => {
    await expect(
      completeTask.run(request({ householdId: 'h1', taskId: 't1', expectedVersion: 3 })),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(store.writes).toEqual([])
  })
  it('confirms the current version and keeps repeated recurring completions idempotent', async () => {
    const input = request({ householdId: 'h1', taskId: 't1', expectedVersion: 4 })
    expect(await completeTask.run(input)).toEqual({ taskId: 't1', nextTaskId: 't1__occurrence_2' })
    expect(store.documents.get('households/h1/tasks/t1')).toMatchObject({
      status: 'DONE',
      version: 5,
    })
    expect(store.documents.get('households/h1/tasks/t1__occurrence_2')).toMatchObject({
      status: 'TODO',
      dueDate: '2026-10-11',
    })
    const writes = [...store.writes]
    expect(await completeTask.run(input)).toEqual({ taskId: 't1', nextTaskId: 't1__occurrence_2' })
    expect(store.writes).toEqual(writes)
  })
  it('rechecks household membership for confirmations', async () => {
    store.documents.delete('households/h1/members/u1')
    await expect(
      completeTask.run(request({ householdId: 'h1', taskId: 't1', expectedVersion: 4 })),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(store.writes).toEqual([])
  })
  it('reuses the preview request ID so a create retry cannot make duplicate tasks', async () => {
    const input = request({ householdId: 'h1', clientRequestId: 'jarvis_test', title: 'Buy bread' })
    expect(await createTask.run(input)).toEqual({ taskId: 'jarvis_test' })
    const writes = [...store.writes]
    expect(await createTask.run(input)).toEqual({ taskId: 'jarvis_test' })
    expect(store.writes).toEqual(writes)
  })
})
