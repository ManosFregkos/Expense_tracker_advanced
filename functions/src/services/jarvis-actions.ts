import { createHash } from 'node:crypto'
import { Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  formatMoney,
  jarvisActionReferenceSchema,
  jarvisPrepareActionSchema,
  normalizeSearchText,
  taskCoreInputSchema,
  transactionInputSchema,
  type HouseholdTask,
  type JarvisAction,
  type JarvisActionProposal,
  type JarvisActionReference,
  type JarvisActionResult,
} from '@family-expense-tracker/shared'
import { parseInput, secureCallable, type Actor } from '../callable.js'
import { db } from '../firebase.js'
import { planTaskCompletion, planTaskCreation, planTaskUpdate } from './tasks.js'
import { planTransactionCreation } from './transactions.js'

const LIFETIME_MS = 120_000
const PREPARES_PER_MINUTE = 20

interface StoredProposal {
  uid: string
  householdId: string
  sessionId: string
  idempotencyKey: string
  requestFingerprint: string
  payloadFingerprint: string
  action: JarvisAction
  summary: string
  status: JarvisActionProposal['status']
  createdAt: Timestamp
  expiresAt: Timestamp
  resolvedAt?: Timestamp
  result: JarvisActionResult | null
}

// Sorted object keys make retries independent of JSON property ordering. Array order is meaningful.
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}
function canonicalAction(action: JarvisAction): JarvisAction {
  if (action.type === 'CREATE_EXPENSE')
    return {
      ...action,
      payload: {
        ...action.payload,
        transactionDate: new Date(action.payload.transactionDate).toISOString(),
        ...(action.payload.tags
          ? { tags: [...new Set(action.payload.tags.map((tag) => tag.toLowerCase()))] }
          : {}),
      },
    }
  if (action.type === 'CREATE_TASK') {
    const recurrence = action.payload.recurrence
    return {
      ...action,
      payload: {
        ...action.payload,
        tags: [...new Set(action.payload.tags.map(normalizeSearchText).filter(Boolean))],
        ...(recurrence
          ? {
              recurrence: {
                ...recurrence,
                ...(recurrence.daysOfWeek
                  ? { daysOfWeek: [...new Set(recurrence.daysOfWeek)].sort((a, b) => a - b) }
                  : {}),
              },
            }
          : {}),
      },
    }
  }
  return action
}
function view(proposalId: string, proposal: StoredProposal): JarvisActionProposal {
  return {
    proposalId,
    householdId: proposal.householdId,
    sessionId: proposal.sessionId,
    action: proposal.action,
    summary: proposal.summary,
    status: proposal.status,
    createdAt: proposal.createdAt.toDate().toISOString(),
    expiresAt: proposal.expiresAt.toDate().toISOString(),
    result: proposal.result,
  }
}
async function context(transaction: Transaction, householdId: string, actor: Actor) {
  const [member, household] = await Promise.all([
    transaction.get(db.doc(`households/${householdId}/members/${actor.uid}`)),
    transaction.get(db.doc(`households/${householdId}`)),
  ])
  if (!member.exists) throw new HttpsError('permission-denied', 'Household access denied.')
  if (!household.exists) throw new HttpsError('not-found', 'Household not found.')
  return { timeZone: String(household.get('timeZone')) }
}

interface ActionPlan {
  summary: string
  payloadFingerprint: string
  result: JarvisActionResult
  commit: () => void
}

// All reads precede all writes. Preparation discards the commit closure; confirmation
// uses it in the transaction that also resolves the proposal. No nested transactions.
async function planAction(
  transaction: Transaction,
  householdId: string,
  actor: Actor,
  action: JarvisAction,
  proposalId: string,
  timeZone: string,
): Promise<ActionPlan> {
  const entityId = `jarvis_${proposalId}`
  if (action.type === 'CREATE_EXPENSE') {
    const payload = action.payload
    const [account, category, existing] = await Promise.all([
      transaction.get(db.doc(`households/${householdId}/accounts/${payload.accountId}`)),
      transaction.get(db.doc(`households/${householdId}/categories/${payload.categoryId}`)),
      transaction.get(db.doc(`households/${householdId}/transactions/${entityId}`)),
    ])
    if (existing.exists) throw new HttpsError('already-exists', 'The target transaction exists.')
    if (!account.exists || !category.exists)
      throw new HttpsError(
        'failed-precondition',
        'Select an existing account and expense category.',
      )
    const ownerUserId: unknown = account.get('ownerUserId')
    if (typeof ownerUserId !== 'string' || !ownerUserId || ownerUserId.includes('/'))
      throw new HttpsError('failed-precondition', 'The selected account has no valid owner.')
    const input = parseInput(transactionInputSchema, {
      ...payload,
      householdId,
      type: 'EXPENSE',
      ownerUserId,
      source: 'MANUAL',
    })
    const plan = await planTransactionCreation(transaction, input, actor, entityId)
    const accountName = String(account.get('name') ?? payload.accountId)
    const categoryName = String(category.get('name') ?? payload.categoryId)
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(payload.transactionDate))
    return {
      summary: `Create expense ${formatMoney(payload.amountMinor, payload.currency)}: ${payload.description}; account ${accountName}; category ${categoryName}; date ${localDate} (${timeZone}).`,
      payloadFingerprint: fingerprint({ action, ownerUserId, accountName, categoryName, timeZone }),
      result: { entityId },
      commit: plan.commit,
    }
  }
  if (action.type === 'CREATE_TASK') {
    const payload = action.payload
    const [existing, assignee, list] = await Promise.all([
      transaction.get(db.doc(`households/${householdId}/tasks/${entityId}`)),
      payload.assigneeUserId
        ? transaction.get(db.doc(`households/${householdId}/members/${payload.assigneeUserId}`))
        : null,
      payload.listId
        ? transaction.get(db.doc(`households/${householdId}/taskLists/${payload.listId}`))
        : null,
    ])
    if (existing.exists) throw new HttpsError('already-exists', 'The target task exists.')
    const plan = await planTaskCreation(
      transaction,
      { ...payload, householdId, clientRequestId: entityId },
      actor,
    )
    const assigneeName = assignee
      ? String(assignee.get('displayName') ?? payload.assigneeUserId)
      : null
    const listName = list ? String(list.get('name') ?? payload.listId) : null
    return {
      summary: `Create task “${payload.title}”; due ${payload.dueDate ?? 'no date'} ${payload.dueTime ?? ''} (${timeZone}); assignee ${assigneeName ?? 'unassigned'}; list ${listName ?? 'none'}${payload.recurrence ? '; recurring' : ''}.`,
      payloadFingerprint: fingerprint({ action, timeZone, assigneeName, listName }),
      result: { entityId: plan.taskId },
      commit: plan.commit,
    }
  }
  const snapshot = await transaction.get(
    db.doc(`households/${householdId}/tasks/${action.payload.taskId}`),
  )
  if (!snapshot.exists || snapshot.get('isDeleted') === true)
    throw new HttpsError('not-found', 'Task not found.')
  const task = snapshot.data() as HouseholdTask
  // Enforce the proposal version even when ordinary completeTask would return DONE idempotently.
  if (task.version !== action.payload.expectedVersion)
    throw new HttpsError('aborted', 'This task changed. Request a fresh proposal.')
  if (task.status === 'DONE' || task.status === 'CANCELLED')
    throw new HttpsError('failed-precondition', 'Reopen this task before changing it.')
  const payloadFingerprint = fingerprint({ action, title: task.title, timeZone })
  if (action.type === 'COMPLETE_TASK') {
    const plan = await planTaskCompletion(transaction, { ...action.payload, householdId }, actor)
    return {
      summary: `Complete task “${task.title}”${task.recurrence ? '; creates the next occurrence if the series continues' : ''}.`,
      payloadFingerprint,
      result: { entityId: plan.taskId, nextTaskId: plan.nextTaskId },
      commit: plan.commit,
    }
  }
  // Only the date/time change. Preserve every other field and the recurring series.
  const replacement = parseInput(taskCoreInputSchema, {
    ...task,
    ...action.payload,
    recurrence: task.recurrence
      ? { ...task.recurrence, untilDate: task.recurrence.untilDateKey }
      : null,
  })
  const plan = await planTaskUpdate(
    transaction,
    {
      householdId,
      taskId: task.id,
      expectedVersion: action.payload.expectedVersion,
      task: replacement,
    },
    actor,
  )
  return {
    summary: `Reschedule task “${task.title}” to ${action.payload.dueDate} ${action.payload.dueTime ?? 'all day'} (${timeZone}).`,
    payloadFingerprint,
    result: { entityId: plan.taskId },
    commit: plan.commit,
  }
}

export const jarvisPrepareAction = secureCallable(
  jarvisPrepareActionSchema,
  async (input, actor) => {
    // Scope the retry key to the actor across households and sessions; conflicting reuse fails.
    const proposalId = fingerprint([actor.uid, input.idempotencyKey])
    const ref = db.doc(`privateJarvisActions/${proposalId}`)
    const requestFingerprint = fingerprint(input)
    return db.runTransaction(async (transaction) => {
      const { timeZone } = await context(transaction, input.householdId, actor)
      const existing = await transaction.get(ref)
      if (existing.exists) {
        const proposal = existing.data() as StoredProposal
        if (proposal.requestFingerprint !== requestFingerprint)
          throw new HttpsError('already-exists', 'This idempotency key belongs to another request.')
        return view(proposalId, expire(transaction, ref, proposal))
      }
      const limitRef = db.doc(`privateJarvisActionLimits/${fingerprint(actor.uid)}`)
      const limit = await transaction.get(limitRef)
      const now = Timestamp.now()
      const windowStart = limit.get('windowStart') as Timestamp | undefined
      const sameWindow = windowStart && now.toMillis() - windowStart.toMillis() < 60_000
      const count = sameWindow ? Number(limit.get('count')) : 0
      if (count >= PREPARES_PER_MINUTE)
        throw new HttpsError('resource-exhausted', 'Too many proposals. Try again in a minute.')
      const action = canonicalAction(input.action)
      const plan = await planAction(
        transaction,
        input.householdId,
        actor,
        action,
        proposalId,
        timeZone,
      )
      const proposal: StoredProposal = {
        ...input,
        action,
        uid: actor.uid,
        requestFingerprint,
        payloadFingerprint: plan.payloadFingerprint,
        summary: plan.summary,
        status: 'PENDING',
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + LIFETIME_MS),
        result: null,
      }
      transaction.create(ref, proposal)
      transaction.set(limitRef, { windowStart: sameWindow ? windowStart : now, count: count + 1 })
      return view(proposalId, proposal)
    })
  },
)

function expire(
  transaction: Transaction,
  ref: DocumentReference,
  proposal: StoredProposal,
): StoredProposal {
  if (proposal.status !== 'PENDING' || proposal.expiresAt.toMillis() > Date.now()) return proposal
  const expired: StoredProposal = { ...proposal, status: 'EXPIRED', resolvedAt: Timestamp.now() }
  transaction.update(ref, { status: expired.status, resolvedAt: expired.resolvedAt })
  return expired
}

async function resolveAction(
  input: JarvisActionReference,
  actor: Actor,
  operation: 'CONFIRM' | 'CANCEL' | 'STATUS',
): Promise<JarvisActionProposal> {
  const ref = db.doc(`privateJarvisActions/${input.proposalId}`)
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Proposal not found.')
    let proposal = snapshot.data() as StoredProposal
    if (
      proposal.uid !== actor.uid ||
      proposal.householdId !== input.householdId ||
      proposal.sessionId !== input.sessionId
    )
      throw new HttpsError('permission-denied', 'Proposal access denied.')
    const { timeZone } = await context(transaction, proposal.householdId, actor)
    proposal = expire(transaction, ref, proposal)
    if (proposal.status !== 'PENDING' || operation === 'STATUS')
      return view(input.proposalId, proposal)
    if (operation === 'CANCEL') {
      proposal = { ...proposal, status: 'CANCELLED', resolvedAt: Timestamp.now() }
    } else {
      const plan = await planAction(
        transaction,
        proposal.householdId,
        actor,
        proposal.action,
        input.proposalId,
        timeZone,
      )
      if (plan.payloadFingerprint !== proposal.payloadFingerprint)
        throw new HttpsError(
          'failed-precondition',
          'Proposal details changed. Request a fresh proposal.',
        )
      // Recheck after all business reads, before staging any business writes.
      const expired = expire(transaction, ref, proposal)
      if (expired.status === 'EXPIRED') return view(input.proposalId, expired)
      plan.commit()
      proposal = {
        ...proposal,
        status: 'COMMITTED',
        resolvedAt: Timestamp.now(),
        result: plan.result,
      }
    }
    transaction.update(ref, {
      status: proposal.status,
      resolvedAt: proposal.resolvedAt,
      result: proposal.result,
    })
    return view(input.proposalId, proposal)
  })
  // Throw outside the transaction so an EXPIRED transition is retained.
  if (operation === 'CONFIRM' && result.status !== 'COMMITTED')
    throw new HttpsError(
      'failed-precondition',
      `Proposal is ${result.status.toLowerCase()}. Request a fresh proposal.`,
    )
  return result
}

// These endpoints are client controllers' APIs, never model-callable tools.
export const jarvisConfirmAction = secureCallable(jarvisActionReferenceSchema, (input, actor) =>
  resolveAction(input, actor, 'CONFIRM'),
)
export const jarvisCancelAction = secureCallable(jarvisActionReferenceSchema, (input, actor) =>
  resolveAction(input, actor, 'CANCEL'),
)
export const jarvisActionStatus = secureCallable(jarvisActionReferenceSchema, (input, actor) =>
  resolveAction(input, actor, 'STATUS'),
)
