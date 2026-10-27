import { createHash, randomUUID } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JarvisActionInput, JarvisChatInput } from '@family-expense-tracker/shared'
import { jarvisAction, jarvisChat } from './jarvis.js'
import { runJarvisAgent } from './jarvis-agent.js'

const store = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  writes: [] as string[],
  nextId: 0,
}))
vi.mock('./jarvis-agent.js', () => ({ runJarvisAgent: vi.fn() }))
vi.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => 'test-only' }),
  defineString: () => ({ value: () => 'test-model' }),
}))
vi.mock('../firebase.js', () => {
  const snapshot = (path: string) => {
    const data = store.documents.get(path)
    return {
      id: path.split('/').at(-1)!,
      exists: Boolean(data),
      data: () => data,
      get: (key: string) => data?.[key],
    }
  }
  const ref = (path: string) => ({
    path,
    id: path.split('/').at(-1)!,
    get: async () => snapshot(path),
  })
  const collection = (path: string, maximum = 1000) => ({
    doc: () => ref(`${path}/generated-${++store.nextId}`),
    limit: (size: number) => collection(path, size),
    orderBy: () => collection(path, maximum),
    // Date filtering is not exercised here; candidate ambiguity and scope are.
    where: () => collection(path, maximum),
    get: async () => {
      const docs = [...store.documents.keys()]
        .filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
        .slice(0, maximum)
        .map(snapshot)
      return { docs, size: docs.length }
    },
  })
  return {
    db: {
      doc: ref,
      collection,
      runTransaction: async (callback: (value: unknown) => Promise<unknown>) => {
        const writes: {
          reference: { path: string }
          value: Record<string, unknown>
          update: boolean
        }[] = []
        const result = await callback({
          get: async (reference: { path: string }) => {
            if (writes.length) throw new Error('Firestore read after write')
            return snapshot(reference.path)
          },
          set: (reference: { path: string }, value: Record<string, unknown>) =>
            writes.push({ reference, value, update: false }),
          update: (reference: { path: string }, value: Record<string, unknown>) =>
            writes.push({ reference, value, update: true }),
        })
        writes.forEach(({ reference, value, update }) => {
          store.documents.set(
            reference.path,
            update ? { ...store.documents.get(reference.path), ...value } : value,
          )
          store.writes.push(reference.path)
        })
        return result
      },
    },
  }
})
function request(data: unknown, uid = 'u1', verified = true) {
  return {
    data,
    auth: { uid, token: { email: 'member@example.test', email_verified: verified } },
  } as Parameters<typeof jarvisChat.run>[0]
}
let input: JarvisChatInput
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const requestPath = () => `privateJarvisRequests/${hash(`u1:h1:${input.requestId}`)}`
const actionInput = (decision: JarvisActionInput['decision'] = 'CONFIRM'): JarvisActionInput => ({
  householdId: 'h1',
  sessionId: input.sessionId,
  requestId: input.requestId,
  decision,
})
const proposal = {
  kind: 'CREATE_TRANSACTION',
  data: {
    type: 'EXPENSE',
    amount: '30.00',
    currency: 'EUR',
    accountId: 'a1',
    categoryId: 'groceries',
    description: 'Supermarket',
    date: '2026-10-27',
  },
} as const
beforeEach(() => {
  vi.clearAllMocks()
  store.documents.clear()
  store.writes = []
  store.nextId = 0
  input = {
    householdId: 'h1',
    sessionId: randomUUID(),
    requestId: randomUUID(),
    message: 'Add 30 euro supermarket',
    language: 'en-US',
    defaultAccountId: 'a1',
  }
  store.documents.set('households/h1', {
    id: 'h1',
    timeZone: 'Europe/Athens',
    defaultCurrency: 'EUR',
  })
  store.documents.set('households/h1/members/u1', { userId: 'u1', role: 'MEMBER' })
  store.documents.set('households/h1/accounts/a1', {
    id: 'a1',
    name: 'Cash',
    ownerUserId: 'u1',
    type: 'CASH',
    currency: 'EUR',
    currentBalanceMinor: 0,
    isArchived: false,
  })
  store.documents.set('households/h1/categories/groceries', {
    id: 'groceries',
    name: 'Groceries',
    type: 'EXPENSE',
    isArchived: false,
  })
  vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
    await options.validate(proposal)
    return { reply: '', proposal }
  })
})
async function previewDeletion() {
  const deletion = { kind: 'DELETE_TRANSACTION', data: { transactionId: 't1' } } as const
  vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
    await options.search({
      query: 'supermarket',
      amount: '30',
      currency: 'EUR',
      accountId: null,
      date: null,
      type: 'EXPENSE',
    })
    await options.validate(deletion)
    return { reply: '', proposal: deletion }
  })
  store.documents.set('households/h1/transactions/t1', {
    id: 't1',
    householdId: 'h1',
    type: 'EXPENSE',
    amountMinor: 3000,
    currency: 'EUR',
    description: 'Supermarket',
    accountId: 'a1',
    ownerUserId: 'u1',
    categoryId: 'groceries',
    transactionDate: Timestamp.fromDate(new Date('2026-10-26T12:00:00Z')),
    updatedAt: Timestamp.now(),
    isDeleted: false,
  })
  return jarvisChat.run(request(input))
}
describe('Jarvis server actions', () => {
  it('converts salary income to minor units and increases the normal income analytics', async () => {
    const income = {
      ...proposal,
      data: {
        ...proposal.data,
        type: 'INCOME',
        amount: '1500',
        categoryId: 'salary',
        description: 'Salary',
      },
    } as const
    store.documents.set('households/h1/categories/salary', {
      id: 'salary',
      name: 'Salary',
      type: 'INCOME',
      isArchived: false,
    })
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      await options.validate(income)
      return { reply: '', proposal: income }
    })
    await jarvisChat.run(request(input))
    await jarvisAction.run(request(actionInput()))
    expect(store.documents.get('households/h1/monthlyAnalytics/2026-10')).toMatchObject({
      incomeMinor: 150000,
      expenseMinor: 0,
    })
    expect(store.documents.get('households/h1/accounts/a1')?.appCalculatedBalanceMinor).toBe(150000)
  })
  it('rejects direct deletion proposals without a search', async () => {
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      const deletion = { kind: 'DELETE_TRANSACTION', data: { transactionId: 't1' } } as const
      await options.validate(deletion)
      return { reply: '', proposal: deletion }
    })
    await expect(jarvisChat.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
  it('prepares without financial writes, then commits accounting and receipt atomically; retries do not duplicate', async () => {
    const response = await jarvisChat.run(request(input))
    expect(response.action?.kind).toBe('CREATE_TRANSACTION')
    expect(store.writes.every((path) => !path.startsWith('households/'))).toBe(true)
    const result = await jarvisAction.run(request(actionInput()))
    expect(result.status).toBe('COMPLETED')
    expect(store.documents.get(`households/h1/transactions/${result.entityId}`)).toMatchObject({
      amountMinor: 3000,
      ownerUserId: 'u1',
    })
    expect(store.documents.get('households/h1/monthlyAnalytics/2026-10')).toMatchObject({
      expenseMinor: 3000,
      transactionCount: 1,
    })
    const writes = [...store.writes]
    expect(await jarvisAction.run(request(actionInput()))).toEqual(result)
    expect(store.writes).toEqual(writes)
    expect(await jarvisChat.run(request(input))).toEqual(response)
    expect(runJarvisAgent).toHaveBeenCalledOnce()
  })
  it('soft deletes an exact confirmed record through the normal accounting service', async () => {
    await previewDeletion()
    expect(store.documents.get('households/h1/transactions/t1')?.isDeleted).toBe(false)
    await jarvisAction.run(request(actionInput()))
    expect(store.documents.get('households/h1/transactions/t1')?.isDeleted).toBe(true)
    expect(store.documents.get('households/h1/accounts/a1')?.appCalculatedBalanceMinor).toBe(3000)
  })
  it('rejects a stale deletion preview without financial writes', async () => {
    await previewDeletion()
    store.documents.get('households/h1/transactions/t1')!.updatedAt = Timestamp.fromMillis(
      Date.now() + 1000,
    )
    const writes = [...store.writes]
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'aborted',
    })
    expect(store.writes).toEqual(writes)
  })
  it('requires an unambiguous search and refuses arbitrary or duplicate deletion targets', async () => {
    await previewDeletion()
    input.requestId = randomUUID()
    store.documents.set('households/h1/transactions/t2', {
      ...store.documents.get('households/h1/transactions/t1'),
      id: 't2',
    })
    await expect(jarvisChat.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    expect(store.documents.get('households/h1/transactions/t1')?.isDeleted).toBe(false)
  })
  it('refuses a seemingly unique deletion when the search window is truncated', async () => {
    await previewDeletion()
    input.requestId = randomUUID()
    for (let index = 0; index < 100; index += 1)
      store.documents.set(`households/h1/transactions/other-${index}`, {
        ...store.documents.get('households/h1/transactions/t1'),
        description: 'Unrelated purchase',
      })
    await expect(jarvisChat.run(request(input))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
  it('cancels without writing financial data and cannot confirm a cancelled proposal', async () => {
    await jarvisChat.run(request(input))
    expect((await jarvisAction.run(request(actionInput('CANCEL')))).status).toBe('CANCELLED')
    expect((await jarvisAction.run(request(actionInput()))).status).toBe('CANCELLED')
    expect(store.writes.every((path) => !path.startsWith('households/'))).toBe(true)
  })
  it('rechecks membership, actor identity, session binding, expiry, and email verification', async () => {
    await jarvisChat.run(request(input))
    await expect(jarvisAction.run(request(actionInput(), 'outsider'))).rejects.toMatchObject({
      code: 'permission-denied',
    })
    await expect(
      jarvisAction.run(request({ ...actionInput(), sessionId: randomUUID() })),
    ).rejects.toMatchObject({ code: 'not-found' })
    await expect(jarvisAction.run(request(actionInput(), 'u1', false))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    store.documents.get(requestPath())!.actionExpiresAt = Timestamp.fromMillis(0)
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    store.documents.delete('households/h1/members/u1')
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })
  it('revalidates archived accounts and request IDs before committing', async () => {
    await jarvisChat.run(request(input))
    await expect(
      jarvisChat.run(request({ ...input, message: 'Different request' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    store.documents.get('households/h1/accounts/a1')!.isArchived = true
    await expect(jarvisAction.run(request(actionInput()))).rejects.toMatchObject({
      code: 'failed-precondition',
    })
    expect(store.writes.every((path) => !path.startsWith('households/'))).toBe(true)
  })
  it('creates todos in the existing task module with an idempotent receipt', async () => {
    const task = {
      kind: 'CREATE_TASK',
      data: {
        title: 'Buy milk',
        listId: null,
        dueDate: '2026-10-28',
        dueTime: null,
        priority: 'HIGH',
      },
    } as const
    vi.mocked(runJarvisAgent).mockImplementation(async (options) => {
      await options.validate(task)
      return { reply: '', proposal: task }
    })
    await jarvisChat.run(request(input))
    const result = await jarvisAction.run(request(actionInput()))
    expect(store.documents.get(`households/h1/tasks/${result.entityId}`)).toMatchObject({
      title: 'Buy milk',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: '2026-10-28',
    })
    const writes = [...store.writes]
    expect(await jarvisAction.run(request(actionInput()))).toEqual(result)
    expect(store.writes).toEqual(writes)
  })
})
