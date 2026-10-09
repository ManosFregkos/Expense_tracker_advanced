import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import {
  taskDueAt,
  type Household,
  type JarvisMorningBriefing,
} from '@family-expense-tracker/shared'
import { createAppToolExecutor } from './jarvis-app-tools.js'

const store = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  paths: [] as string[],
}))
vi.mock('../firebase.js', () => {
  const snapshot = (path: string, value?: Record<string, unknown>) => ({
    id: path.split('/').at(-1)!,
    exists: Boolean(value),
    data: () => value,
    get: (key: string) => value?.[key],
  })
  const compare = (value: unknown): string | number =>
    value instanceof Timestamp
      ? value.toMillis()
      : typeof value === 'string'
        ? value
        : Number(value)
  return {
    db: {
      doc: (path: string) => ({
        get: async () => {
          store.paths.push(path)
          return snapshot(path, store.documents.get(path))
        },
      }),
      collection: (path: string) => {
        const filters: Array<[string, string, unknown]> = []
        let order: [string, string] | undefined
        let limit = Infinity
        const query = {
          where: (key: string, op: string, value: unknown) => {
            filters.push([key, op, value])
            return query
          },
          orderBy: (key: string, direction = 'asc') => {
            order = [key, direction]
            return query
          },
          limit: (value: number) => {
            limit = value
            return query
          },
          get: async () => {
            store.paths.push(path)
            let entries = [...store.documents].filter(
              ([key, doc]) =>
                key.startsWith(`${path}/`) &&
                key.slice(path.length + 1).indexOf('/') === -1 &&
                filters.every(([field, op, value]) => {
                  const actual = doc[field]
                  if (op === '==') return actual === value
                  if (op === 'in') return (value as unknown[]).includes(actual)
                  if (op === 'array-contains')
                    return (actual as unknown[] | undefined)?.includes(value)
                  if (actual == null) return false
                  if (op === '>=') return compare(actual) >= compare(value)
                  if (op === '<=') return compare(actual) <= compare(value)
                  if (op === '<') return compare(actual) < compare(value)
                  return false
                }),
            )
            if (order) {
              const [key, direction] = order
              entries = entries
                .filter(([, doc]) => doc[key] !== undefined)
                .sort(([, a], [, b]) => {
                  const left = compare(a[key])
                  const right = compare(b[key])
                  return (
                    (left < right ? -1 : left > right ? 1 : 0) * (direction === 'desc' ? -1 : 1)
                  )
                })
            }
            return { docs: entries.slice(0, limit).map(([key, doc]) => snapshot(key, doc)) }
          },
        }
        return query
      },
    },
  }
})
const household = { id: 'h1', timeZone: 'Europe/Athens', defaultCurrency: 'EUR' } as Household
const now = new Date('2026-10-09T21:30:00Z') // October 10 in Athens
const task = {
  title: 'Buy groceries',
  status: 'TODO',
  priority: 'HIGH',
  dueDate: '2026-10-10',
  dueTime: null,
  dueAt: Timestamp.fromDate(taskDueAt('2026-10-10', null, household.timeZone)),
  assigneeUserId: 'u1',
  tags: ['shopping'],
  sortOrder: 10,
  version: 3,
  isDeleted: false,
  updatedAt: Timestamp.fromDate(now),
}
beforeEach(() => {
  store.documents.clear()
  store.paths = []
})
describe('authorized Jarvis app tools', () => {
  it('builds all four morning briefing sections using the household date and recorded bills', async () => {
    store.documents.set('households/h1/tasks/today', { ...task })
    store.documents.set('households/h1/tasks/old', {
      ...task,
      dueDate: '2026-10-09',
      dueAt: Timestamp.fromDate(taskDueAt('2026-10-09', null, household.timeZone)),
    })
    store.documents.set('households/h1/taskLists/task-list-bills-admin', { name: 'Bills & Admin' })
    store.documents.set('households/h1/taskLists/greek', { name: 'Λογαριασμοί' })
    store.documents.set('households/h1/taskLists/archived', { name: 'Bills', isArchived: true })
    for (const [id, patch] of Object.entries({
      electricity: { listId: 'task-list-bills-admin', dueDate: '2026-10-12' },
      water: { listId: 'greek', dueDate: '2026-10-17' },
      beyond: { listId: 'greek', dueDate: '2026-10-18' },
      closed: { listId: 'greek', dueDate: '2026-10-12', status: 'DONE' },
      deleted: { listId: 'greek', dueDate: '2026-10-12', isDeleted: true },
      archived: { listId: 'archived', dueDate: '2026-10-12' },
    }))
      store.documents.set(`households/h1/tasks/${id}`, {
        ...task,
        ...patch,
        dueAt: Timestamp.fromDate(taskDueAt(patch.dueDate, null, household.timeZone)),
      })
    store.documents.set('households/h1/monthlyAnalytics/2026-10', {
      expenseMinor: 10500,
      byMember: { u1: 2500, u2: 8000 },
    })
    store.documents.set('households/h2/tasks/secret', { ...task })
    const app = createAppToolExecutor('h1', 'u1', household, now)
    const result = (await app.execute('get_morning_briefing', {
      scope: 'household',
    })) as JarvisMorningBriefing
    expect(result).toMatchObject({
      date: '2026-10-10',
      timeZone: 'Europe/Athens',
      today: { tasks: [{ id: 'today' }], truncated: false },
      overdue: { tasks: [{ id: 'old' }], truncated: false },
      upcomingBills: {
        tasks: [{ id: 'electricity' }, { id: 'water' }],
        throughDate: '2026-10-17',
        source: 'bill_tasks',
        listConfigured: true,
      },
      monthlySpending: { month: '2026-10', expenseMinor: 10500, currency: 'EUR', available: true },
    })
    expect(app.briefing).toEqual(result)
    expect(app.action).toBeNull()
    expect(store.paths.every((path) => path.startsWith('households/h1/'))).toBe(true)
    expect(store.documents.get('households/h1/tasks/today')?.status).toBe('TODO')
    expect(await app.execute('get_morning_briefing', { scope: 'mine' })).toMatchObject({
      monthlySpending: { expenseMinor: 2500 },
    })
  })
  it('discloses missing briefing data and bounds task results without inventing bills or totals', async () => {
    const app = createAppToolExecutor('h1', 'u1', household, now)
    expect(await app.execute('get_morning_briefing', { scope: 'mine' })).toMatchObject({
      upcomingBills: { tasks: [], listConfigured: false },
      monthlySpending: { available: false, expenseMinor: null },
    })
    for (let i = 0; i < 202; i++) store.documents.set(`households/h1/tasks/t${i}`, { ...task })
    expect(await app.execute('get_morning_briefing', { scope: 'household' })).toMatchObject({
      today: { truncated: true },
      upcomingBills: { truncated: true },
    })
    expect(await app.execute('get_morning_briefing', { scope: 'outsider' })).toHaveProperty('error')
  })
  it('reads personal balances separately by currency and distinguishes bank reports', async () => {
    store.documents.set('households/h1/accounts/a1', {
      ownerUserId: 'u1',
      name: 'Cash',
      type: 'CASH',
      currency: 'EUR',
      appCalculatedBalanceMinor: 12345,
      currentBalanceMinor: 1,
      updatedAt: Timestamp.fromDate(now),
    })
    store.documents.set('households/h1/accounts/a2', {
      ownerUserId: 'u1',
      name: 'Card',
      type: 'CREDIT_CARD',
      currency: 'USD',
      currentBalanceMinor: -200,
      bankReportedBalance: {
        currency: 'USD',
        outstandingMinor: 250,
        reportedAt: Timestamp.fromDate(now),
      },
    })
    store.documents.set('households/h1/accounts/archived', {
      ownerUserId: 'u1',
      isArchived: true,
      currency: 'EUR',
    })
    store.documents.set('households/h1/accounts/other', { ownerUserId: 'u2', currency: 'EUR' })
    store.documents.set('households/h2/accounts/private', { ownerUserId: 'u1', currency: 'EUR' })
    const result = await createAppToolExecutor('h1', 'u1', household, now).execute(
      'get_account_balances',
      { scope: 'mine', householdId: 'h2', userId: 'u2' },
    )
    expect(result).toMatchObject({
      accounts: [
        {
          name: 'Cash',
          currency: 'EUR',
          appCalculatedBalanceMinor: 12345,
          appUpdatedAt: now.toISOString(),
          bankReportedBalance: null,
        },
        {
          name: 'Card',
          currency: 'USD',
          appCalculatedBalanceMinor: -200,
          bankReportedBalance: { outstandingMinor: 250, reportedAt: now.toISOString() },
        },
      ],
    })
    expect(store.paths).toEqual(['households/h1/accounts'])
  })
  it('searches normalized merchants within inclusive local dates without leaking other households or deleted records', async () => {
    const base = {
      merchant: 'LÍDL',
      description: 'Weekly shopping',
      amountMinor: 2500,
      currency: 'EUR',
      type: 'EXPENSE',
      ownerUserId: 'u1',
      searchPrefixes: ['lidl'],
      isDeleted: false,
    }
    for (const [id, data] of Object.entries({
      start: { ...base, transactionDate: Timestamp.fromDate(new Date('2026-10-09T21:00:00Z')) },
      end: { ...base, transactionDate: Timestamp.fromDate(new Date('2026-10-10T20:59:59.999Z')) },
      before: { ...base, transactionDate: Timestamp.fromDate(new Date('2026-10-09T20:59:59Z')) },
      after: { ...base, transactionDate: Timestamp.fromDate(new Date('2026-10-10T21:00:00Z')) },
      deleted: { ...base, isDeleted: true, transactionDate: Timestamp.fromDate(now) },
      other: { ...base, ownerUserId: 'u2', transactionDate: Timestamp.fromDate(now) },
    }))
      store.documents.set(`households/h1/transactions/${id}`, data)
    store.documents.set('households/h2/transactions/secret', {
      ...base,
      transactionDate: Timestamp.fromDate(now),
    })
    const app = createAppToolExecutor('h1', 'u1', household, now)
    expect(
      await app.execute('search_transactions', {
        search: 'Lidl',
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        scope: 'mine',
      }),
    ).toMatchObject({
      truncated: false,
      transactions: [
        { id: 'end', date: '2026-10-10' },
        { id: 'start', date: '2026-10-10' },
      ],
    })
    expect(
      await app.execute('search_transactions', {
        search: null,
        startDate: '2026-02-30',
        endDate: null,
        scope: 'household',
      }),
    ).toHaveProperty('error')
    expect(
      await app.execute('search_transactions', {
        search: null,
        startDate: '2026-10-11',
        endDate: '2026-10-10',
        scope: 'household',
      }),
    ).toHaveProperty('error')
    expect(store.paths).toEqual(['households/h1/transactions'])
  })
  it('reports partial transaction and task results rather than pretending the list is complete', async () => {
    for (let i = 0; i < 302; i++)
      store.documents.set(`households/h1/transactions/t${i}`, {
        isDeleted: false,
        type: 'EXPENSE',
        ownerUserId: 'u2',
        transactionDate: Timestamp.fromDate(now),
      })
    const app = createAppToolExecutor('h1', 'u1', household, now)
    expect(
      await app.execute('search_transactions', {
        search: null,
        startDate: null,
        endDate: null,
        scope: 'mine',
      }),
    ).toMatchObject({ truncated: true, transactions: [] })
    for (let i = 0; i < 202; i++) store.documents.set(`households/h1/tasks/t${i}`, { ...task })
    const result = (await app.execute('list_tasks', {
      filter: 'today',
      scope: 'mine',
      search: null,
    })) as { tasks: unknown[]; truncated: boolean }
    expect(result.truncated).toBe(true)
    expect(result.tasks).toHaveLength(30)
  })
  it('uses the household date for today and only considers open tasks overdue', async () => {
    store.documents.set('households/h1/tasks/today', { ...task })
    store.documents.set('households/h1/tasks/old', {
      ...task,
      dueDate: '2026-10-09',
      dueAt: Timestamp.fromDate(taskDueAt('2026-10-09', null, household.timeZone)),
    })
    store.documents.set('households/h1/tasks/timed', {
      ...task,
      dueTime: '00:15',
      dueAt: Timestamp.fromDate(taskDueAt('2026-10-10', '00:15', household.timeZone)),
    })
    for (const [id, patch] of Object.entries({
      done: { status: 'DONE' },
      cancelled: { status: 'CANCELLED' },
      deleted: { isDeleted: true },
      other: { assigneeUserId: 'u2' },
    }))
      store.documents.set(`households/h1/tasks/${id}`, { ...task, ...patch })
    const app = createAppToolExecutor('h1', 'u1', household, now)
    expect(
      await app.execute('list_tasks', { filter: 'today', scope: 'mine', search: null }),
    ).toMatchObject({ today: '2026-10-10', tasks: [{ id: 'timed' }, { id: 'today' }] })
    expect(
      await app.execute('list_tasks', { filter: 'overdue', scope: 'mine', search: null }),
    ).toMatchObject({ tasks: [{ id: 'old' }, { id: 'timed' }] })
  })
  it('proposes creation without writing, validates relations and allows one proposal', async () => {
    store.documents.set('households/h1/members/u1', { displayName: 'Manos' })
    store.documents.set('households/h1/taskLists/shopping', { name: 'Shopping', isArchived: false })
    const app = createAppToolExecutor('h1', 'u1', household, now)
    const value = {
      title: 'Buy milk',
      dueDate: '2026-10-10',
      dueTime: null,
      priority: 'NONE',
      assigneeUserId: 'u1',
      listId: 'shopping',
    }
    for (const patch of [
      { assigneeUserId: '../h2' },
      { assigneeUserId: 'outsider' },
      { listId: 'invented' },
      { dueDate: null, dueTime: '10:00' },
    ])
      expect(await app.execute('draft_task_create', { ...value, ...patch })).toHaveProperty('error')
    expect(await app.execute('draft_task_create', value)).toMatchObject({
      status: 'confirmation_required',
      saved: false,
    })
    expect(app.action).toMatchObject({
      kind: 'create',
      assigneeName: 'Manos',
      listName: 'Shopping',
      clientRequestId: expect.stringMatching(/^jarvis_/),
      task: { status: 'TODO', tags: [], title: 'Buy milk' },
    })
    expect(await app.execute('draft_task_create', value)).toHaveProperty('error')
    expect(store.documents.size).toBe(2)
  })
  it('uses actual titles/versions for completion and preserves recurrence/reminders when rescheduling', async () => {
    store.documents.set('households/h1/tasks/t1', {
      ...task,
      reminderOffsetMinutes: 30,
      recurrence: {
        frequency: 'WEEKLY',
        interval: 1,
        endType: 'UNTIL_DATE',
        untilDateKey: '2027-01-01',
      },
    })
    const app = createAppToolExecutor('h1', 'u1', household, now)
    expect(await app.execute('draft_task_complete', { taskId: 'h2/tasks/secret' })).toHaveProperty(
      'error',
    )
    expect(await app.execute('draft_task_complete', { taskId: 'invented' })).toHaveProperty('error')
    expect(await app.execute('draft_task_complete', { taskId: 't1' })).toMatchObject({
      saved: false,
    })
    expect(app.action).toEqual({
      kind: 'complete',
      taskId: 't1',
      title: 'Buy groceries',
      expectedVersion: 3,
      recurring: true,
    })
    const reschedule = createAppToolExecutor('h1', 'u1', household, now)
    expect(
      await reschedule.execute('draft_task_reschedule', {
        taskId: 't1',
        dueDate: null,
        dueTime: null,
      }),
    ).toHaveProperty('error')
    await reschedule.execute('draft_task_reschedule', {
      taskId: 't1',
      dueDate: '2026-10-12',
      dueTime: '10:00',
    })
    expect(reschedule.action).toMatchObject({
      kind: 'reschedule',
      expectedVersion: 3,
      task: {
        tags: ['shopping'],
        reminderOffsetMinutes: 30,
        recurrence: { untilDate: '2027-01-01' },
        dueDate: '2026-10-12',
      },
    })
    expect(store.documents.get('households/h1/tasks/t1')?.dueDate).toBe('2026-10-10')
  })
})
