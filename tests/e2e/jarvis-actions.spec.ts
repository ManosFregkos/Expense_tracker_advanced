import { randomUUID, createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { JarvisActionProposal } from '@family-expense-tracker/shared'

test('authenticated Jarvis callable protocol commits an expense once and rejects unauthorized confirmation', async ({
  request,
}) => {
  // Admin is test-fixture code only. Fail closed before initializing any SDK clients.
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8280' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9199'
  )
    throw new Error('This test requires the demo e2e Auth and Firestore emulators.')
  const app = initializeApp(
    { projectId: 'demo-family-expense-tracker' },
    `jarvis-e2e-${randomUUID()}`,
  )
  const database = getFirestore(app)
  const users: Array<{ uid: string; token: string }> = []
  let householdId: string | undefined
  try {
    const signIn = async (verified: boolean) => {
      const email = `jarvis-${randomUUID()}@example.test`
      const password = 'TestOnlyPassword123!'
      const registration = await request.post(
        'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',
        { data: { email, password, returnSecureToken: true } },
      )
      expect(registration.ok()).toBe(true)
      const user = (await registration.json()) as { localId: string; idToken: string }
      users.push({ uid: user.localId, token: user.idToken })
      if (verified) {
        // Native ESM helper avoids Playwright's Node 22 CJS/ESM Auth-loader conflict.
        await promisify(execFile)(process.execPath, [
          resolve('tests/e2e/helpers/verify-user.mjs'),
          email,
        ])
      }
      const response = await request.post(
        'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',
        { data: { email, password, returnSecureToken: true } },
      )
      expect(response.ok()).toBe(true)
      const { idToken } = (await response.json()) as { idToken: string }
      return { uid: user.localId, token: idToken }
    }
    const actor = await signIn(true)
    const stranger = await signIn(true)
    const unverified = await signIn(false)
    const post = (name: string, data: unknown, token = actor.token) =>
      request.post(`http://127.0.0.1:5101/demo-family-expense-tracker/europe-west1/${name}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { data },
      })
    const call = async <T>(name: string, data: unknown): Promise<T> => {
      const response = await post(name, data)
      expect(response.ok()).toBe(true)
      const body = (await response.json()) as { result: T }
      return body.result
    }
    const household = await call<{ householdId: string }>('createHousehold', {
      name: 'Jarvis callable test',
      displayName: 'Test actor',
      defaultCurrency: 'EUR',
      timeZone: 'Europe/Athens',
    })
    householdId = household.householdId
    const { accountId } = await call<{ accountId: string }>('createAccount', {
      householdId,
      ownerUserId: actor.uid,
      name: 'Alpha',
      type: 'BANK',
      currency: 'EUR',
      openingBalanceMinor: 10_000,
    })
    const sessionId = randomUUID()
    const input = {
      householdId,
      sessionId,
      idempotencyKey: randomUUID(),
      action: {
        type: 'CREATE_EXPENSE',
        payload: {
          accountId,
          categoryId: 'expense-food-supermarket',
          amountMinor: 4500,
          currency: 'EUR',
          description: 'Supermarket',
          transactionDate: '2026-10-19T09:00:00.000Z',
        },
      },
    }
    const base = `households/${householdId}`
    const auditCount = (await database.collection(`${base}/auditLogs`).get()).size
    const proposal = await call<JarvisActionProposal>('jarvisPrepareAction', input)
    expect(proposal.status).toBe('PENDING')
    expect((await database.collection(`${base}/transactions`).get()).empty).toBe(true)
    expect(
      (await database.doc(`${base}/accounts/${accountId}`).get()).get('currentBalanceMinor'),
    ).toBe(10_000)
    expect((await database.collection(`${base}/auditLogs`).get()).size).toBe(auditCount)
    expect(await call<JarvisActionProposal>('jarvisPrepareAction', input)).toEqual(proposal)
    const reference = { householdId, sessionId, proposalId: proposal.proposalId }
    for (const [token, status] of [
      [stranger.token, 'PERMISSION_DENIED'],
      [unverified.token, 'FAILED_PRECONDITION'],
    ] as const) {
      const response = await post('jarvisConfirmAction', reference, token)
      expect(response.ok()).toBe(false)
      expect(await response.json()).toMatchObject({ error: { status } })
    }
    const [first, retry] = await Promise.all([
      call<JarvisActionProposal>('jarvisConfirmAction', reference),
      call<JarvisActionProposal>('jarvisConfirmAction', reference),
    ])
    expect(first).toEqual(retry)
    expect(first.status).toBe('COMMITTED')
    expect((await database.collection(`${base}/transactions`).get()).size).toBe(1)
    expect(
      (await database.doc(`${base}/accounts/${accountId}`).get()).get('currentBalanceMinor'),
    ).toBe(5500)
    expect((await database.doc(`${base}/monthlyAnalytics/2026-10`).get()).data()).toMatchObject({
      expenseMinor: 4500,
      transactionCount: 1,
    })
    expect((await database.collection(`${base}/auditLogs`).get()).size).toBe(auditCount + 1)
    expect(await call<JarvisActionProposal>('jarvisActionStatus', reference)).toEqual(first)
    const cancelled = await call<JarvisActionProposal>('jarvisPrepareAction', {
      ...input,
      idempotencyKey: randomUUID(),
    })
    const cancellation = { ...reference, proposalId: cancelled.proposalId }
    expect((await call<JarvisActionProposal>('jarvisCancelAction', cancellation)).status).toBe(
      'CANCELLED',
    )
    const rejected = await post('jarvisConfirmAction', cancellation)
    expect(await rejected.json()).toMatchObject({ error: { status: 'FAILED_PRECONDITION' } })
    expect((await database.collection(`${base}/transactions`).get()).size).toBe(1)
  } finally {
    if (householdId) await database.recursiveDelete(database.doc(`households/${householdId}`))
    for (const { uid, token } of users) {
      const proposals = await database
        .collection('privateJarvisActions')
        .where('uid', '==', uid)
        .get()
      const batch = database.batch()
      proposals.docs.forEach((doc) => batch.delete(doc.ref))
      batch.delete(
        database.doc(
          `privateJarvisActionLimits/${createHash('sha256').update(JSON.stringify(uid)).digest('hex')}`,
        ),
      )
      await batch.commit()
      await database.recursiveDelete(database.doc(`users/${uid}`))
      await request.post(
        'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:delete?key=fake-api-key',
        { data: { idToken: token } },
      )
    }
    await deleteApp(app)
  }
})
