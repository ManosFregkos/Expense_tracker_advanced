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
        setDoc(doc(database, 'households/h1/taskLists/list1'), {
          id: 'list1',
          householdId: 'h1',
          isArchived: false,
        }),
        setDoc(doc(database, 'households/h1/tasks/task1'), {
          id: 'task1',
          householdId: 'h1',
          isDeleted: false,
          status: 'TODO',
        }),
        setDoc(doc(database, 'households/h1/tasks/deleted-task'), {
          id: 'deleted-task',
          householdId: 'h1',
          isDeleted: true,
          status: 'TODO',
        }),
        setDoc(doc(database, 'households/h1/tasks/task1/subtasks/sub1'), {
          id: 'sub1',
          householdId: 'h1',
          taskId: 'task1',
        }),
        setDoc(doc(database, 'households/h1/taskActivity/activity1'), {
          id: 'activity1',
          householdId: 'h1',
          taskId: 'task1',
        }),
        setDoc(doc(database, 'households/h2/tasks/task2'), {
          id: 'task2',
          householdId: 'h2',
          isDeleted: false,
          status: 'TODO',
        }),
        setDoc(doc(database, 'households/h1/childProfiles/child1'), {
          id: 'child1',
          householdId: 'h1',
          displayName: 'Kid',
        }),
        setDoc(doc(database, 'households/h1/kidsSessions/session1'), {
          id: 'session1',
          householdId: 'h1',
          childProfileId: 'child1',
        }),
        setDoc(doc(database, 'households/h1/kidsAttempts/attempt1'), {
          id: 'attempt1',
          householdId: 'h1',
          childProfileId: 'child1',
        }),
        setDoc(doc(database, 'households/h1/kidsCardProgress/child1_apple'), {
          householdId: 'h1',
          childProfileId: 'child1',
          cardId: 'apple',
        }),
        setDoc(doc(database, 'households/h2/kidsSessions/session2'), {
          id: 'session2',
          householdId: 'h2',
          childProfileId: 'child2',
        }),
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

  it('isolates tasks, subtasks, lists, and activity by household', async () => {
    const alice = environment.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(alice, 'households/h1/tasks/task1')))
    await assertSucceeds(getDoc(doc(alice, 'households/h1/tasks/task1/subtasks/sub1')))
    await assertSucceeds(getDoc(doc(alice, 'households/h1/taskLists/list1')))
    await assertSucceeds(getDoc(doc(alice, 'households/h1/taskActivity/activity1')))
    await assertFails(getDoc(doc(alice, 'households/h2/tasks/task2')))
    await assertFails(getDoc(doc(alice, 'households/h1/tasks/deleted-task')))
  })

  it('denies all direct task-domain writes', async () => {
    const alice = environment.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(alice, 'households/h1/tasks/task3'), { isDeleted: false }))
    await assertFails(
      setDoc(doc(alice, 'households/h1/tasks/task1/subtasks/sub2'), { title: 'Injected' }),
    )
    await assertFails(setDoc(doc(alice, 'households/h1/taskLists/list2'), { name: 'Injected' }))
    await assertFails(
      setDoc(doc(alice, 'households/h1/taskActivity/activity2'), { action: 'FAKE' }),
    )
  })

  it('isolates Kids learning data and denies all direct writes', async () => {
    const alice = environment.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(alice, 'households/h1/childProfiles/child1')))
    await assertSucceeds(getDoc(doc(alice, 'households/h1/kidsSessions/session1')))
    await assertSucceeds(getDoc(doc(alice, 'households/h1/kidsAttempts/attempt1')))
    await assertSucceeds(getDoc(doc(alice, 'households/h1/kidsCardProgress/child1_apple')))
    await assertFails(getDoc(doc(alice, 'households/h2/kidsSessions/session2')))
    await assertFails(
      setDoc(doc(alice, 'households/h1/kidsAttempts/injected'), { isCorrect: true }),
    )
    await assertFails(
      setDoc(doc(alice, 'households/h2/kidsCardProgress/injected'), { cardId: 'apple' }),
    )
  })
})
