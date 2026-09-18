import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip

describeWithEmulator('Firestore household isolation', () => {
  let environment: RulesTestEnvironment
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'demo-family-expense-tracker-rules',
      firestore: { rules: await readFile('firestore.rules', 'utf8') },
    })
  })
  beforeEach(async () => {
    await environment.clearFirestore()
    await environment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await Promise.all([
        setDoc(doc(database, 'households/h1'), { id: 'h1', name: 'Household One' }),
        setDoc(doc(database, 'households/h1/members/alice'), {
          userId: 'alice',
          householdId: 'h1',
          role: 'OWNER',
        }),
        setDoc(doc(database, 'households/h1/accounts/a1'), { id: 'a1', householdId: 'h1' }),
        setDoc(doc(database, 'households/h2'), { id: 'h2', name: 'Household Two' }),
        setDoc(doc(database, 'households/h2/members/bob'), {
          userId: 'bob',
          householdId: 'h2',
          role: 'OWNER',
        }),
        setDoc(doc(database, 'households/h2/accounts/a2'), { id: 'a2', householdId: 'h2' }),
        setDoc(doc(database, 'households/h1/monthlyAnalytics/2026-09'), { incomeMinor: 100 }),
        setDoc(doc(database, 'households/h1/auditLogs/log1'), { action: 'CREATE_ACCOUNT' }),
      ])
    })
  })
  afterAll(async () => environment.cleanup())

  it('allows members to read their household and denies cross-household reads', async () => {
    const alice = environment
      .authenticatedContext('alice', { email: 'alice@example.test' })
      .firestore()
    await assertSucceeds(getDoc(doc(alice, 'households/h1/accounts/a1')))
    await assertFails(getDoc(doc(alice, 'households/h2/accounts/a2')))
  })

  it('allows a member-scoped collection query', async () => {
    const alice = environment
      .authenticatedContext('alice', { email: 'alice@example.test' })
      .firestore()
    const result = await assertSucceeds(getDocs(collection(alice, 'households/h1/accounts')))
    expect(result.size).toBe(1)
  })

  it('denies direct financial, aggregate, audit, and membership writes', async () => {
    const alice = environment
      .authenticatedContext('alice', { email: 'alice@example.test' })
      .firestore()
    await assertFails(setDoc(doc(alice, 'households/h1/transactions/t1'), { amountMinor: 100 }))
    await assertFails(
      setDoc(doc(alice, 'households/h1/monthlyAnalytics/2026-10'), { incomeMinor: 1 }),
    )
    await assertFails(setDoc(doc(alice, 'households/h1/auditLogs/log2'), { action: 'FAKE' }))
    await assertFails(setDoc(doc(alice, 'households/h1/members/mallory'), { role: 'OWNER' }))
  })

  it('does not expose another household through a query', async () => {
    const alice = environment
      .authenticatedContext('alice', { email: 'alice@example.test' })
      .firestore()
    await assertFails(
      getDocs(query(collection(alice, 'households/h2/accounts'), where('householdId', '==', 'h2'))),
    )
  })
})
