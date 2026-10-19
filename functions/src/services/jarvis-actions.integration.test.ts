import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import type { JarvisAction, JarvisActionProposal } from '@family-expense-tracker/shared'
import { db } from '../firebase.js'
import {
  jarvisPrepareAction,
  jarvisConfirmAction,
  jarvisCancelAction,
  jarvisActionStatus,
} from './jarvis-actions.js'
import { createTask, completeTask, updateTask } from './tasks.js'
import { createTransaction } from './transactions.js'

// Financial idempotency requires a real emulator. Never fall through to a real project.
const emulator = process.env.FIRESTORE_EMULATOR_HOST
if (emulator) {
  if (
    !/^(127\.0\.0\.1|localhost):\d+$/.test(emulator ?? '') ||
    !process.env.GCLOUD_PROJECT?.startsWith('demo-')
  )
    throw new Error('Tests require a loopback Firestore emulator and demo- project.')
}
const suite = emulator ? describe : describe.skip
const householdId = `jarvis-actions-${randomUUID()}`
const uid = `actor-${randomUUID()}`
const otherUid = `other-${randomUUID()}`
const sessionId = randomUUID()
const base = `households/${householdId}`
const expense: JarvisAction = {
  type: 'CREATE_EXPENSE',
  payload: {
    accountId: 'alpha',
    categoryId: 'fuel',
    amountMinor: 2800,
    currency: 'EUR',
    description: 'Fuel',
    transactionDate: '2026-09-30T22:30:00.000Z',
    merchant: 'Station',
    tags: ['Car'],
  },
}
function request(data: unknown, user = uid, verified = true) {
  return {
    data,
    auth: { uid: user, token: { email: `${user}@example.test`, email_verified: verified } },
  } as Parameters<typeof jarvisPrepareAction.run>[0]
}
async function prepare(action: JarvisAction = expense, idempotencyKey = randomUUID()) {
  return jarvisPrepareAction.run(request({ householdId, sessionId, idempotencyKey, action }))
}
function reference(proposal: JarvisActionProposal) {
  return { householdId, sessionId, proposalId: proposal.proposalId }
}
async function confirm(proposal: JarvisActionProposal) {
  return jarvisConfirmAction.run(request(reference(proposal)))
}
async function domainSnapshot() {
  const [account, transactions, analytics, tasks, audits, activity, notifications] =
    await Promise.all([
      db.doc(`${base}/accounts/alpha`).get(),
      db.collection(`${base}/transactions`).get(),
      db.collection(`${base}/monthlyAnalytics`).get(),
      db.collection(`${base}/tasks`).get(),
      db.collection(`${base}/auditLogs`).get(),
      db.collection(`${base}/taskActivity`).get(),
      db.collection(`users/${otherUid}/taskNotifications`).get(),
    ])
  return {
    account: account.data(),
    transactions: transactions.docs.map((doc) => doc.data()),
    analytics: analytics.docs.map((doc) => doc.data()),
    tasks: tasks.docs.map((doc) => doc.data()),
    audits: audits.docs.map((doc) => doc.data()),
    activity: activity.docs.map((doc) => doc.data()),
    notifications: notifications.docs.map((doc) => doc.data()),
  }
}
async function seedTask(recurrence = false) {
  const { taskId } = await createTask.run(
    request({
      householdId,
      clientRequestId: 'task',
      title: 'Call accountant',
      dueDate: '2026-10-20',
      dueTime: '10:00',
      assigneeUserId: otherUid,
      listId: 'bills',
      reminderOffsetMinutes: 30,
      ...(recurrence ? { recurrence: { frequency: 'DAILY', interval: 1, endType: 'NEVER' } } : {}),
    }),
  )
  return taskId
}
async function clearFixtures() {
  await db.recursiveDelete(db.doc(base))
  await db.recursiveDelete(db.doc(`users/${otherUid}`))
  const proposals = await db.collection('privateJarvisActions').where('uid', '==', uid).get()
  const batch = db.batch()
  proposals.docs.forEach((doc) => batch.delete(doc.ref))
  // Quota identity is hashed; remove only this test actor's bucket.
  const { createHash } = await import('node:crypto')
  const hash = createHash('sha256').update(JSON.stringify(uid)).digest('hex')
  batch.delete(db.doc(`privateJarvisActionLimits/${hash}`))
  await batch.commit()
}

suite('Jarvis action protocol against Firestore emulator', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await clearFixtures()
    const batch = db.batch()
    batch.set(db.doc(base), { id: householdId, timeZone: 'Europe/Athens', defaultCurrency: 'EUR' })
    batch.set(db.doc(`${base}/members/${uid}`), {
      userId: uid,
      role: 'MEMBER',
      displayName: 'Actor',
    })
    batch.set(db.doc(`${base}/members/${otherUid}`), {
      userId: otherUid,
      role: 'MEMBER',
      displayName: 'Other',
    })
    batch.set(db.doc(`${base}/accounts/alpha`), {
      id: 'alpha',
      householdId,
      name: 'Alpha',
      ownerUserId: uid,
      type: 'BANK',
      currency: 'EUR',
      currentBalanceMinor: 100_000,
      isArchived: false,
    })
    batch.set(db.doc(`${base}/categories/fuel`), {
      id: 'fuel',
      householdId,
      name: 'Fuel',
      type: 'EXPENSE',
      isArchived: false,
    })
    batch.set(db.doc(`${base}/taskLists/bills`), {
      id: 'bills',
      householdId,
      name: 'Bills',
      isArchived: false,
    })
    batch.set(db.doc(`users/${otherUid}/taskNotificationSettings/${householdId}`), {
      assignmentNotifications: true,
    })
    await batch.commit()
  })
  afterAll(clearFixtures)

  it('prepares an exact expense preview without writing business data, activity, or audit', async () => {
    const before = await domainSnapshot()
    const proposal = await prepare()
    expect(proposal).toMatchObject({
      status: 'PENDING',
      action: { ...expense, payload: { ...expense.payload, tags: ['car'] } },
      result: null,
    })
    expect(proposal.summary).toContain('€28.00')
    expect(proposal.summary).toContain('Alpha')
    expect(proposal.summary).toContain('Fuel')
    expect(proposal.summary).toContain('2026-10-01')
    expect(Date.parse(proposal.expiresAt) - Date.parse(proposal.createdAt)).toBe(120_000)
    expect(await domainSnapshot()).toEqual(before)
    expect((await db.doc(`privateJarvisActions/${proposal.proposalId}`).get()).get('uid')).toBe(uid)
  })

  it('atomically confirms once, updates timezone-month analytics and both balances, and preserves the audit', async () => {
    const proposal = await prepare()
    const committed = await confirm(proposal)
    expect(committed.status).toBe('COMMITTED')
    const state = await domainSnapshot()
    expect(state.account).toMatchObject({
      currentBalanceMinor: 97_200,
      appCalculatedBalanceMinor: 97_200,
    })
    expect(state.transactions).toHaveLength(1)
    expect(state.transactions[0]).toMatchObject({
      id: committed.result?.entityId,
      createdBy: uid,
      ownerUserId: uid,
      source: 'MANUAL',
      amountMinor: 2800,
      type: 'EXPENSE',
      tags: ['car'],
    })
    expect(state.analytics).toHaveLength(1)
    expect(state.analytics[0]).toMatchObject({
      monthKey: '2026-10',
      expenseMinor: 2800,
      transactionCount: 1,
      byCategory: { fuel: 2800 },
      byMember: { [uid]: 2800 },
      byAccount: { alpha: 2800 },
      byMerchant: { station: 2800 },
      byTag: { car: 2800 },
    })
    expect(state.audits).toHaveLength(1)
    expect(state.audits[0]).toMatchObject({
      action: 'CREATE_TRANSACTION',
      entityId: committed.result?.entityId,
      userId: uid,
      householdId,
      changes: { after: { amountMinor: 2800 } },
    })
    expect(state.audits[0]?.timestamp).toBeInstanceOf(Timestamp)
    expect((state.audits[0]?.changes as { after: object }).after).not.toHaveProperty(
      'searchPrefixes',
    )
    // Treat the first response as lost; retry after the successful durable commit.
    expect(await confirm(proposal)).toEqual(committed)
    expect(await jarvisActionStatus.run(request(reference(proposal)))).toEqual(committed)
    expect(await domainSnapshot()).toEqual(state)
  })

  it('serializes concurrent confirmation requests into one mutation and one audit', async () => {
    const proposal = await prepare()
    const results = await Promise.all(Array.from({ length: 6 }, () => confirm(proposal)))
    expect(new Set(results.map((result) => result.result?.entityId)).size).toBe(1)
    expect(results.every((result) => result.status === 'COMMITTED')).toBe(true)
    const state = await domainSnapshot()
    expect(state.transactions).toHaveLength(1)
    expect(state.audits).toHaveLength(1)
    expect(state.account?.currentBalanceMinor).toBe(97_200)
    expect(state.analytics[0]?.transactionCount).toBe(1)
  })

  it('reuses identical preparation retries and refuses conflicting payload, session, or household', async () => {
    const key = randomUUID()
    const [first, second] = await Promise.all([prepare(expense, key), prepare(expense, key)])
    expect(first).toEqual(second)
    await expect(
      prepare({ ...expense, payload: { ...expense.payload, amountMinor: 2900 } }, key),
    ).rejects.toMatchObject({ code: 'already-exists' })
    await expect(
      jarvisPrepareAction.run(
        request({ householdId, sessionId: randomUUID(), idempotencyKey: key, action: expense }),
      ),
    ).rejects.toMatchObject({ code: 'already-exists' })
    expect((await domainSnapshot()).transactions).toHaveLength(0)
  })

  it('cancels idempotently and never confirms a cancelled proposal', async () => {
    const proposal = await prepare()
    const cancelled = await jarvisCancelAction.run(request(reference(proposal)))
    expect(cancelled.status).toBe('CANCELLED')
    expect(await jarvisCancelAction.run(request(reference(proposal)))).toEqual(cancelled)
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await domainSnapshot()).transactions).toHaveLength(0)
    expect((await domainSnapshot()).audits).toHaveLength(0)
  })

  it('serializes cancellation racing confirmation without reporting a false cancellation', async () => {
    const proposal = await prepare()
    const outcomes = await Promise.allSettled([
      confirm(proposal),
      jarvisCancelAction.run(request(reference(proposal))),
    ])
    const final = await jarvisActionStatus.run(request(reference(proposal)))
    const state = await domainSnapshot()
    expect(['CANCELLED', 'COMMITTED']).toContain(final.status)
    expect(state.transactions).toHaveLength(final.status === 'COMMITTED' ? 1 : 0)
    expect(state.audits).toHaveLength(state.transactions.length)
    if (final.status === 'CANCELLED') expect(outcomes[0].status).toBe('rejected')
    else expect(outcomes[1]).toMatchObject({ status: 'fulfilled', value: { status: 'COMMITTED' } })
  })

  it('expires pending proposals durably and never revives an expired retry key', async () => {
    const key = randomUUID()
    const proposal = await prepare(expense, key)
    await db
      .doc(`privateJarvisActions/${proposal.proposalId}`)
      .update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) })
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await jarvisActionStatus.run(request(reference(proposal)))).status).toBe('EXPIRED')
    expect((await prepare(expense, key)).status).toBe('EXPIRED')
    expect((await domainSnapshot()).transactions).toHaveLength(0)
  })

  it('keeps a committed retry authoritative even after expiry and cancel', async () => {
    const proposal = await prepare()
    const committed = await confirm(proposal)
    await db
      .doc(`privateJarvisActions/${proposal.proposalId}`)
      .update({ expiresAt: Timestamp.fromMillis(1) })
    expect((await confirm(proposal)).result).toEqual(committed.result)
    expect((await jarvisCancelAction.run(request(reference(proposal)))).status).toBe('COMMITTED')
  })

  it('requires authentication and verified email for every endpoint', async () => {
    const proposal = await prepare()
    for (const endpoint of [
      jarvisPrepareAction,
      jarvisConfirmAction,
      jarvisCancelAction,
      jarvisActionStatus,
    ]) {
      await expect(
        endpoint.run({ data: reference(proposal) } as Parameters<typeof endpoint.run>[0]),
      ).rejects.toMatchObject({ code: 'unauthenticated' })
      await expect(endpoint.run(request(reference(proposal), uid, false))).rejects.toMatchObject({
        code: 'failed-precondition',
      })
    }
  })

  it('denies a different member and mismatched household/session for every resolution API', async () => {
    const proposal = await prepare()
    for (const endpoint of [jarvisConfirmAction, jarvisCancelAction, jarvisActionStatus]) {
      await expect(endpoint.run(request(reference(proposal), otherUid))).rejects.toMatchObject({
        code: 'permission-denied',
      })
      await expect(
        endpoint.run(request({ ...reference(proposal), householdId: 'elsewhere' })),
      ).rejects.toMatchObject({ code: 'permission-denied' })
      await expect(
        endpoint.run(request({ ...reference(proposal), sessionId: randomUUID() })),
      ).rejects.toMatchObject({ code: 'permission-denied' })
    }
    expect((await domainSnapshot()).transactions).toHaveLength(0)
  })

  it('rechecks household membership at prepare, confirm, status and cancel', async () => {
    const proposal = await prepare()
    await db.doc(`${base}/members/${uid}`).delete()
    await expect(prepare()).rejects.toMatchObject({ code: 'permission-denied' })
    for (const endpoint of [jarvisConfirmAction, jarvisCancelAction, jarvisActionStatus])
      await expect(endpoint.run(request(reference(proposal)))).rejects.toMatchObject({
        code: 'permission-denied',
      })
    expect((await domainSnapshot()).transactions).toHaveLength(0)
  })

  it.each(['accountId', 'categoryId'] as const)(
    'rejects missing, cross-household, or archived %s',
    async (field) => {
      await expect(
        prepare({ ...expense, payload: { ...expense.payload, [field]: 'missing' } }),
      ).rejects.toMatchObject({ code: 'failed-precondition' })
      const path = field === 'accountId' ? 'accounts/alpha' : 'categories/fuel'
      await db.doc(`${base}/${path}`).update({ isArchived: true })
      await expect(prepare()).rejects.toMatchObject({ code: 'failed-precondition' })
      expect((await domainSnapshot()).transactions).toHaveLength(0)
    },
  )

  it('revalidates category type, account currency and owner, without writing partial financial effects', async () => {
    const proposal = await prepare()
    await db.doc(`${base}/accounts/alpha`).update({ currency: 'USD' })
    const before = await domainSnapshot()
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(await domainSnapshot()).toEqual(before)
    await db.doc(`${base}/accounts/alpha`).update({ currency: 'EUR', ownerUserId: otherUid })
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'failed-precondition' })
    await db.doc(`${base}/accounts/alpha`).update({ ownerUserId: uid })
    await db.doc(`${base}/categories/fuel`).update({ type: 'INCOME' })
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await domainSnapshot()).transactions).toHaveLength(0)
  })

  it('requires a fresh preview when mutable displayed details change', async () => {
    const proposal = await prepare()
    await db.doc(`${base}/accounts/alpha`).update({ name: 'Renamed account' })
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await domainSnapshot()).transactions).toHaveLength(0)
  })

  it('creates tasks with existing assignment notifications, reminders, recurrence, activity and audits', async () => {
    const action: JarvisAction = {
      type: 'CREATE_TASK',
      payload: {
        title: 'Pay bills',
        status: 'TODO',
        priority: 'HIGH',
        tags: [],
        listId: 'bills',
        assigneeUserId: otherUid,
        dueDate: '2026-10-20',
        dueTime: '10:00',
        reminderOffsetMinutes: 30,
        recurrence: { frequency: 'MONTHLY', interval: 1, endType: 'NEVER' },
      },
    }
    const before = await domainSnapshot()
    const proposal = await prepare(action)
    expect(await domainSnapshot()).toEqual(before)
    const committed = await confirm(proposal)
    expect(await confirm(proposal)).toEqual(committed)
    const state = await domainSnapshot()
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]).toMatchObject({
      id: committed.result?.entityId,
      assigneeUserId: otherUid,
      reminderState: 'PENDING',
      recurrence: { frequency: 'MONTHLY' },
      version: 1,
    })
    expect(state.notifications).toHaveLength(1)
    expect(state.activity).toHaveLength(1)
    expect(state.audits.map((audit) => String(audit.action)).sort()).toEqual([
      'TASK_CREATED',
      'TASK_RECURRENCE_CREATED',
    ])
  })

  it('completes recurring tasks and creates exactly one next occurrence across concurrent retries', async () => {
    const taskId = await seedTask(true)
    const proposal = await prepare({
      type: 'COMPLETE_TASK',
      payload: { taskId, expectedVersion: 1 },
    })
    const results = await Promise.all([confirm(proposal), confirm(proposal)])
    expect(results[0]).toEqual(results[1])
    expect(results[0].result?.nextTaskId).toBe('task__occurrence_2')
    const state = await domainSnapshot()
    expect(state.tasks).toHaveLength(2)
    expect(state.tasks.find((task) => task.id === taskId)).toMatchObject({
      status: 'DONE',
      version: 2,
      reminderState: 'CANCELLED',
    })
    expect(state.tasks.find((task) => task.id !== taskId)).toMatchObject({
      status: 'TODO',
      dueDate: '2026-10-21',
      reminderState: 'PENDING',
      previousOccurrenceId: taskId,
    })
    expect(state.audits.filter((audit) => audit.action === 'TASK_COMPLETED')).toHaveLength(1)
  })

  it('reschedules through existing task logic while retaining recurrence, reminders and other fields', async () => {
    const taskId = await seedTask(true)
    const proposal = await prepare({
      type: 'RESCHEDULE_TASK',
      payload: { taskId, expectedVersion: 1, dueDate: '2026-10-22', dueTime: '11:30' },
    })
    const before = await db.doc(`${base}/tasks/${taskId}`).get()
    await confirm(proposal)
    await confirm(proposal)
    const task = (await db.doc(`${base}/tasks/${taskId}`).get()).data()!
    expect(task).toMatchObject({
      title: 'Call accountant',
      assigneeUserId: otherUid,
      listId: 'bills',
      dueDate: '2026-10-22',
      dueTime: '11:30',
      version: 2,
      recurrence: { frequency: 'DAILY' },
      seriesId: taskId,
      reminderState: 'PENDING',
    })
    expect(task.createdAt).toEqual(before.get('createdAt'))
    expect((task.dueAt as Timestamp).toDate().toISOString()).toBe('2026-10-22T08:30:00.000Z')
    expect((task.reminderAt as Timestamp).toDate().toISOString()).toBe('2026-10-22T08:00:00.000Z')
    expect(
      (await domainSnapshot()).audits.filter((audit) => audit.action === 'TASK_UPDATED'),
    ).toHaveLength(1)
  })

  it.each(['COMPLETE_TASK', 'RESCHEDULE_TASK'] as const)(
    'rejects stale %s proposals even if task was completed elsewhere',
    async (type) => {
      const taskId = await seedTask(true)
      const action: JarvisAction =
        type === 'COMPLETE_TASK'
          ? { type, payload: { taskId, expectedVersion: 1 } }
          : { type, payload: { taskId, expectedVersion: 1, dueDate: '2026-10-21', dueTime: null } }
      const proposal = await prepare(action)
      await completeTask.run(request({ householdId, taskId, expectedVersion: 1 }))
      const before = await domainSnapshot()
      await expect(confirm(proposal)).rejects.toMatchObject({ code: 'aborted' })
      expect(await domainSnapshot()).toEqual(before)
      await expect(prepare(action)).rejects.toMatchObject({ code: 'aborted' })
    },
  )

  it('rejects invalid task relations and revalidates them during confirmation', async () => {
    await expect(
      prepare({
        type: 'CREATE_TASK',
        payload: { title: 'Test', status: 'TODO', priority: 'NONE', tags: [], listId: 'missing' },
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' })
    const proposal = await prepare({
      type: 'CREATE_TASK',
      payload: {
        title: 'Test',
        status: 'TODO',
        priority: 'NONE',
        tags: [],
        assigneeUserId: otherUid,
      },
    })
    await db.doc(`${base}/members/${otherUid}`).delete()
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await domainSnapshot()).tasks).toHaveLength(0)
  })

  it('preserves the ordinary transaction callable and combines its financial effects with confirmed expenses', async () => {
    await createTransaction.run(
      request({ ...expense.payload, householdId, type: 'EXPENSE', ownerUserId: uid }),
    )
    const proposal = await prepare()
    await confirm(proposal)
    const state = await domainSnapshot()
    expect(state.account).toMatchObject({
      currentBalanceMinor: 94_400,
      appCalculatedBalanceMinor: 94_400,
    })
    expect(state.analytics[0]).toMatchObject({ expenseMinor: 5600, transactionCount: 2 })
    expect(state.transactions).toHaveLength(2)
    expect(state.audits.filter((audit) => audit.action === 'CREATE_TRANSACTION')).toHaveLength(2)
  })

  it('does not overwrite an existing target entity or treat it as the proposed task', async () => {
    const proposal = await prepare({
      type: 'CREATE_TASK',
      payload: { title: 'Expected', status: 'TODO', priority: 'NONE', tags: [] },
    })
    await createTask.run(
      request({
        householdId,
        clientRequestId: `jarvis_${proposal.proposalId}`,
        title: 'Unrelated',
      }),
    )
    await expect(confirm(proposal)).rejects.toMatchObject({ code: 'already-exists' })
    expect((await domainSnapshot()).tasks).toHaveLength(1)
  })

  it('bounds preparation rate without charging identical retries again', async () => {
    const proposal = await prepare()
    for (let count = 1; count < 20; count++) await prepare()
    await expect(prepare()).rejects.toMatchObject({ code: 'resource-exhausted' })
    expect(
      await jarvisPrepareAction.run(
        request({
          householdId,
          sessionId,
          idempotencyKey: (await db.doc(`privateJarvisActions/${proposal.proposalId}`).get()).get(
            'idempotencyKey',
          ),
          action: expense,
        }),
      ),
    ).toEqual(proposal)
  })

  it('rejects malformed input before writing any proposal, quota or business record', async () => {
    const before = await domainSnapshot()
    const proposalsBefore = await db
      .collection('privateJarvisActions')
      .where('uid', '==', uid)
      .get()
    for (const payload of [
      { ...expense.payload, amountMinor: 0 },
      { ...expense.payload, amountMinor: 1.5 },
      { ...expense.payload, currency: 'eur' },
      { ...expense.payload, accountId: undefined },
      { ...expense.payload, categoryId: undefined },
      { ...expense.payload, ownerUserId: otherUid },
    ]) {
      await expect(
        jarvisPrepareAction.run(
          request({
            householdId,
            sessionId,
            idempotencyKey: randomUUID(),
            action: { type: 'CREATE_EXPENSE', payload },
          }),
        ),
      ).rejects.toMatchObject({ code: 'invalid-argument' })
    }
    expect(await domainSnapshot()).toEqual(before)
    expect((await db.collection('privateJarvisActions').where('uid', '==', uid).get()).size).toBe(
      proposalsBefore.size,
    )
  })

  it('preserves balances and analytics when distinct confirmed expenses contend on the same account', async () => {
    const first = await prepare()
    const second = await prepare()
    const results = await Promise.all([confirm(first), confirm(second)])
    expect(results[0].result?.entityId).not.toBe(results[1].result?.entityId)
    const state = await domainSnapshot()
    expect(state.transactions).toHaveLength(2)
    expect(state.audits).toHaveLength(2)
    expect(state.account).toMatchObject({
      currentBalanceMinor: 94_400,
      appCalculatedBalanceMinor: 94_400,
    })
    expect(state.analytics[0]).toMatchObject({ expenseMinor: 5600, transactionCount: 2 })
  })

  it('rejects missing expense owner membership and wrong category type during preparation', async () => {
    await db.doc(`${base}/accounts/alpha`).update({ ownerUserId: 'missing' })
    await expect(prepare()).rejects.toMatchObject({ code: 'failed-precondition' })
    await db.doc(`${base}/accounts/alpha`).update({ ownerUserId: uid })
    await db.doc(`${base}/categories/fuel`).update({ type: 'INCOME' })
    await expect(prepare()).rejects.toMatchObject({ code: 'failed-precondition' })
    expect((await domainSnapshot()).transactions).toHaveLength(0)
  })

  it('keeps ordinary task updates compatible after extracting mutation plans', async () => {
    const taskId = await seedTask()
    await updateTask.run(
      request({
        householdId,
        taskId,
        expectedVersion: 1,
        task: { title: 'Updated', dueDate: '2026-10-23', dueTime: '09:00' },
      }),
    )
    expect((await db.doc(`${base}/tasks/${taskId}`).get()).data()).toMatchObject({
      title: 'Updated',
      version: 2,
      dueDate: '2026-10-23',
    })
  })
})
