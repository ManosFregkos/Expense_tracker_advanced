import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { defineString } from 'firebase-functions/params'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  createTaskSchema,
  dateKeyInTimeZone,
  formatMoney,
  jarvisActionSchema,
  jarvisChatSchema,
  normalizeSearchText,
  parseMoneyToMinor,
  transactionInputSchema,
  zonedDateTimeToUtc,
  type Category,
  type CreateTaskInput,
  type FinancialAccount,
  type Household,
  type JarvisActionResult,
  type JarvisReply,
  type TaskList,
  type TransactionInput,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { requireMember } from './permissions.js'
import { planTaskCreation } from './tasks.js'
import { planTransactionCreation, planTransactionDeletion } from './transactions.js'
import { runJarvisAgent, type ChatMessage, type JarvisProposal } from './jarvis-agent.js'
import { resolveJarvisCurrency } from './jarvis-currency.js'
import { jarvisOpenaiKey as openaiKey } from './jarvis-config.js'

const jarvisModel = defineString('JARVIS_MODEL', { default: 'gpt-6-luna' })
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const requestRef = (uid: string, householdId: string, requestId: string) =>
  db.doc(`privateJarvisRequests/${hash(`${uid}:${householdId}:${requestId}`)}`)
const sessionRef = (uid: string, householdId: string, sessionId: string) =>
  db.doc(`privateJarvisSessions/${hash(`${uid}:${householdId}:${sessionId}`)}`)
type PreparedAction =
  | { kind: 'CREATE_TRANSACTION'; input: TransactionInput; entityId: string; summary: string }
  | { kind: 'CREATE_TASK'; input: CreateTaskInput; entityId: string; summary: string }
  | {
      kind: 'DELETE_TRANSACTION'
      transactionId: string
      expectedUpdatedAt: Timestamp
      summary: string
    }

export const jarvisChat = secureCallable(
  jarvisChatSchema,
  async (input, actor): Promise<JarvisReply> => {
    await requireMember(input.householdId, actor.uid)
    const key = openaiKey.value()
    if (!key)
      throw new HttpsError(
        'failed-precondition',
        'Jarvis needs OPENAI_API_KEY configured on the server.',
      )
    const ref = requestRef(actor.uid, input.householdId, input.requestId)
    const session = sessionRef(actor.uid, input.householdId, input.sessionId)
    const fingerprint = hash(JSON.stringify(input))
    const rate = db.doc(`privateJarvisRateLimits/${hash(actor.uid)}`)
    const claim = await db.runTransaction(async (transaction) => {
      const [existing, previous, limit] = await Promise.all([
        transaction.get(ref),
        transaction.get(session),
        transaction.get(rate),
      ])
      if (existing.exists) {
        if (existing.get('fingerprint') !== fingerprint)
          throw new HttpsError('invalid-argument', 'Request ID was reused for different content.')
        if (existing.get('response'))
          return { cached: existing.get('response') as JarvisReply, history: [] }
        if (existing.get('status') === 'PROCESSING')
          throw new HttpsError(
            'aborted',
            'This request is still processing. Start a new conversation if it does not finish.',
          )
      }
      const busyUntil = previous.get('busyUntil') as Timestamp | undefined
      if (busyUntil && busyUntil.toMillis() > Date.now())
        throw new HttpsError('aborted', 'Jarvis is still answering your previous request.')
      const window = Math.floor(Date.now() / 60_000)
      const count = limit.get('window') === window ? Number(limit.get('count')) : 0
      if (count >= 20)
        throw new HttpsError(
          'resource-exhausted',
          'Please wait a minute before asking Jarvis again.',
        )
      transaction.set(rate, {
        window,
        count: count + 1,
        expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      })
      transaction.set(ref, {
        uid: actor.uid,
        householdId: input.householdId,
        sessionId: input.sessionId,
        language: input.language,
        fingerprint,
        status: 'PROCESSING',
        expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      })
      const expires = previous.get('expiresAt') as Timestamp | undefined
      const history =
        expires && expires.toMillis() > Date.now()
          ? ((previous.get('messages') as ChatMessage[]) ?? [])
          : []
      transaction.set(session, {
        messages: history,
        busyUntil: Timestamp.fromMillis(Date.now() + 90_000),
        expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      })
      return { cached: null, history }
    })
    if (claim.cached) return claim.cached
    try {
      const base = `households/${input.householdId}`
      const [householdDoc, accountDocs, categoryDocs, listDocs] = await Promise.all([
        db.doc(base).get(),
        db.collection(`${base}/accounts`).limit(201).get(),
        db.collection(`${base}/categories`).limit(201).get(),
        db.collection(`${base}/taskLists`).limit(201).get(),
      ])
      if (!householdDoc.exists) throw new HttpsError('not-found', 'Household not found.')
      if ([accountDocs, categoryDocs, listDocs].some((snapshot) => snapshot.size > 200))
        throw new HttpsError(
          'failed-precondition',
          'This household has too many accounts, categories, or lists for Jarvis. Use manual entry.',
        )
      const household = householdDoc.data() as Household
      const accounts = accountDocs.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }) as FinancialAccount)
        .filter((item) => !item.isArchived)
      const categories = categoryDocs.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }) as Category)
        .filter((item) => !item.isArchived)
      const lists = listDocs.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }) as TaskList)
        .filter((item) => !item.isArchived)
      const today = dateKeyInTimeZone(new Date(), household.timeZone)
      const currency = resolveJarvisCurrency(
        input.message,
        accounts.find((account) => account.id === input.defaultAccountId)?.currency ??
          household.defaultCurrency,
        claim.history,
      )
      let action: PreparedAction | null = null
      let deletionCandidate: { id: string; updatedAt: Timestamp; summary: string } | null = null
      const greek = input.language === 'el-GR'
      const result = await runJarvisAgent({
        apiKey: key,
        model: jarvisModel.value(),
        history: claim.history.slice(-12),
        message: input.message,
        transactionCurrency: currency.currency,
        context: {
          today,
          timeZone: household.timeZone,
          currency: household.defaultCurrency,
          transactionCurrency: currency.currency,
          transactionCurrencySource: currency.source,
          hasVisibleTransactionList: input.visibleTransactionIds !== undefined,
          visibleTransactionCount: input.visibleTransactionIds?.length ?? 0,
          language: input.language,
          defaultAccountId: accounts.some((item) => item.id === input.defaultAccountId)
            ? input.defaultAccountId
            : null,
          accounts: accounts.map(({ id, name, currency, ownerUserId }) => ({
            id,
            name,
            currency,
            ownedByYou: ownerUserId === actor.uid,
          })),
          categories: categories.map(({ id, name, type }) => ({ id, name, type })),
          lists: lists.map(({ id, name }) => ({ id, name })),
        },
        search: async (filter) => {
          deletionCandidate = null
          let query = db.collection(`${base}/transactions`).orderBy('transactionDate', 'desc')
          if (filter.date) {
            const start = zonedDateTimeToUtc(filter.date, '00:00', household.timeZone)
            const next = new Date(`${filter.date}T12:00:00Z`)
            next.setUTCDate(next.getUTCDate() + 1)
            const end = zonedDateTimeToUtc(
              next.toISOString().slice(0, 10),
              '00:00',
              household.timeZone,
            )
            query = query
              .where('transactionDate', '>=', Timestamp.fromDate(start))
              .where('transactionDate', '<', Timestamp.fromDate(end))
          }
          const snapshot = await query.limit(101).get()
          const searchCurrency =
            filter.currency ?? (filter.amount ? household.defaultCurrency : null)
          const amountMinor = filter.amount
            ? parseMoneyToMinor(filter.amount, searchCurrency ?? household.defaultCurrency)
            : null
          const words = normalizeSearchText(filter.query ?? '')
            .split(' ')
            .filter(Boolean)
          const matches = snapshot.docs.slice(0, 100).filter((doc) => {
            const data = doc.data()
            const text = normalizeSearchText(
              `${String(data.description ?? '')} ${String(data.merchant ?? '')}`,
            )
            return (
              !data.isDeleted &&
              !data.deletedAt &&
              ['INCOME', 'EXPENSE'].includes(String(data.type)) &&
              (amountMinor === null || data.amountMinor === amountMinor) &&
              (!searchCurrency || data.currency === searchCurrency) &&
              (!filter.accountId || data.accountId === filter.accountId) &&
              (!filter.type || data.type === filter.type) &&
              words.every((word) => text.includes(word))
            )
          })
          const summaries = matches.slice(0, 20).map((doc) => {
            const data = doc.data()
            const date = dateKeyInTimeZone(
              (data.transactionDate as Timestamp).toDate(),
              household.timeZone,
            )
            const account = accounts.find((item) => item.id === data.accountId)?.name ?? 'Account'
            const summary = `${String(data.description)} · ${formatMoney(Number(data.amountMinor), String(data.currency))} · ${date} · ${account}`
            return { id: doc.id, summary }
          })
          if (matches.length === 1 && snapshot.size <= 100) {
            deletionCandidate = {
              id: matches[0]!.id,
              updatedAt: matches[0]!.get('updatedAt') as Timestamp,
              summary: summaries[0]!.summary,
            }
          }
          return {
            matches: summaries,
            matchCount: matches.length,
            truncated: snapshot.size > 100,
            scope: filter.date ?? 'Most recent 100 records. Older records require an exact date.',
          }
        },
        select: async (selection) => {
          deletionCandidate = null
          const visible = [...new Set(input.visibleTransactionIds ?? [])]
          let matches
          let scope: string
          if (selection.order === 'VISIBLE' && input.visibleTransactionIds !== undefined) {
            const documents = await Promise.all(
              visible.map((id) => db.doc(`${base}/transactions/${id}`).get()),
            )
            matches = documents.filter(
              (doc) =>
                doc.exists &&
                !doc.get('isDeleted') &&
                !doc.get('deletedAt') &&
                (!selection.mineOnly || doc.get('ownerUserId') === actor.uid),
            )
            scope = `${selection.mineOnly ? 'Your matching' : 'Household'} rows in the visible transaction list`
          } else {
            let query = db.collection(`${base}/transactions`).where('isDeleted', '==', false)
            if (selection.mineOnly) query = query.where('ownerUserId', '==', actor.uid)
            const snapshot = await query
              .orderBy('transactionDate', selection.order === 'OLDEST' ? 'asc' : 'desc')
              .limit(selection.position)
              .get()
            matches = snapshot.docs
            scope = `${selection.mineOnly ? 'Your' : 'Household'} transactions, ${selection.order === 'OLDEST' ? 'oldest first' : 'newest first'}`
          }
          const selected = matches[selection.position - 1]
          if (!selected)
            return {
              matches: [],
              scope,
              position: selection.position,
              message: 'No transaction exists at that position. Nothing was selected.',
            }
          if (!['EXPENSE', 'INCOME'].includes(String(selected.get('type'))))
            throw new HttpsError(
              'failed-precondition',
              'That historical transaction type is unsupported. Select another record.',
            )
          const data = selected.data()!
          const date = dateKeyInTimeZone(
            (data.transactionDate as Timestamp).toDate(),
            household.timeZone,
          )
          const accountName = accounts.find((item) => item.id === data.accountId)?.name ?? 'Account'
          const summary = `${String(data.description)} · ${formatMoney(Number(data.amountMinor), String(data.currency))} · ${date} · ${accountName} · ${scope}, position ${selection.position}`
          deletionCandidate = { id: selected.id, updatedAt: data.updatedAt as Timestamp, summary }
          return { matches: [{ id: selected.id, summary }], scope, position: selection.position }
        },
        validate: async (proposal: JarvisProposal) => {
          if (proposal.kind === 'CREATE_TRANSACTION') {
            if (!currency.currency)
              throw new HttpsError(
                'failed-precondition',
                'More than one currency was specified. Ask which currency to use.',
              )
            // Currency comes from the user's words/defaults, never an invented model value.
            const data = { ...proposal.data, currency: currency.currency }
            const account = accounts.find(
              (item) => item.id === data.accountId && item.currency === data.currency,
            )
            const category = categories.find(
              (item) => item.id === data.categoryId && item.type === data.type,
            )
            if (!account || !category)
              throw new HttpsError(
                'failed-precondition',
                'Choose an active account and matching category from this household in the requested currency.',
              )
            const payload = transactionInputSchema.parse({
              ...data,
              householdId: input.householdId,
              amountMinor: parseMoneyToMinor(data.amount, data.currency),
              ownerUserId: account.ownerUserId,
              transactionDate: zonedDateTimeToUtc(
                data.date,
                '12:00',
                household.timeZone,
              ).toISOString(),
              source: 'MANUAL',
            })
            action = {
              kind: proposal.kind,
              input: payload,
              entityId: db.collection(`${base}/transactions`).doc().id,
              summary: `${data.type === 'INCOME' ? (greek ? 'Έσοδο' : 'Income') : greek ? 'Έξοδο' : 'Expense'}: ${formatMoney(payload.amountMinor, data.currency)} · ${data.description} · ${category.name} · ${account.name} · ${data.date}`,
            }
          } else if (proposal.kind === 'CREATE_TASK') {
            const data = proposal.data
            if (data.listId && !lists.some((item) => item.id === data.listId))
              throw new HttpsError('failed-precondition', 'Choose an existing active task list.')
            const entityId = db.collection(`${base}/tasks`).doc().id
            const payload = createTaskSchema.parse({
              ...data,
              householdId: input.householdId,
              clientRequestId: entityId,
            })
            action = {
              kind: proposal.kind,
              input: payload,
              entityId,
              summary: `${data.title}${data.listId ? ` · ${lists.find((item) => item.id === data.listId)!.name}` : ''}${data.dueDate ? ` · ${data.dueDate}${data.dueTime ? ` ${data.dueTime}` : ''}` : ''} · ${data.priority}`,
            }
          } else {
            if (!deletionCandidate || deletionCandidate.id !== proposal.data.transactionId)
              throw new HttpsError(
                'failed-precondition',
                'Search again and identify exactly one transaction before requesting deletion.',
              )
            action = {
              kind: proposal.kind,
              transactionId: deletionCandidate.id,
              expectedUpdatedAt: deletionCandidate.updatedAt,
              summary: deletionCandidate.summary,
            }
          }
        },
      })
      // The validator runs through a callback, so read the resulting union explicitly here.
      const prepared = action as PreparedAction | null
      const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60_000)
      const response: JarvisReply = {
        reply: prepared
          ? `${prepared.kind === 'DELETE_TRANSACTION' ? (greek ? 'Επιβεβαίωσε τη διαγραφή' : 'Confirm deletion') : greek ? 'Έτοιμο για αποθήκευση' : 'Ready to save'}: ${prepared.summary}`
          : result.reply,
        action: prepared
          ? {
              requestId: input.requestId,
              kind: prepared.kind,
              summary: prepared.summary,
              expiresAt: expiresAt.toDate().toISOString(),
            }
          : null,
      }
      await db.runTransaction(async (transaction) => {
        // Revoked membership must not release a proposal or conversation response.
        const member = await transaction.get(db.doc(`${base}/members/${actor.uid}`))
        if (!member.exists) throw new HttpsError('permission-denied', 'Household access denied.')
        transaction.update(ref, {
          response,
          action: prepared,
          status: prepared ? 'PENDING' : 'ANSWERED',
          actionExpiresAt: expiresAt,
        })
        transaction.update(session, {
          busyUntil: Timestamp.fromMillis(0),
          messages: [
            ...claim.history,
            { role: 'user', content: input.message },
            { role: 'assistant', content: response.reply },
          ].slice(-12),
        })
      })
      return response
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        transaction.update(ref, { status: 'FAILED' })
        transaction.update(session, { busyUntil: Timestamp.fromMillis(0) })
      })
      throw error
    }
  },
  true,
  { secrets: [openaiKey], timeoutSeconds: 90, maxInstances: 10 },
)

export const jarvisAction = secureCallable(
  jarvisActionSchema,
  async (input, actor): Promise<JarvisActionResult> => {
    const ref = requestRef(actor.uid, input.householdId, input.requestId)
    const session = sessionRef(actor.uid, input.householdId, input.sessionId)
    return db.runTransaction(async (transaction) => {
      const [member, request, conversation] = await Promise.all([
        transaction.get(db.doc(`households/${input.householdId}/members/${actor.uid}`)),
        transaction.get(ref),
        transaction.get(session),
      ])
      if (!member.exists) throw new HttpsError('permission-denied', 'Household access denied.')
      if (!request.exists || request.get('sessionId') !== input.sessionId)
        throw new HttpsError('not-found', 'Jarvis action not found.')
      const previous = request.get('result') as JarvisActionResult | undefined
      if (previous) return previous
      if (request.get('status') !== 'PENDING')
        throw new HttpsError('failed-precondition', 'This request has no pending action.')
      const greek = request.get('language') === 'el-GR'
      if (input.decision === 'CANCEL') {
        const result: JarvisActionResult = {
          status: 'CANCELLED',
          message: greek
            ? 'Η ενέργεια ακυρώθηκε. Δεν έγινε καμία αλλαγή.'
            : 'Action cancelled. Nothing changed.',
        }
        transaction.update(ref, { status: 'CANCELLED', result })
        const messages = (conversation.get('messages') as ChatMessage[]) ?? []
        transaction.update(session, {
          messages: [...messages, { role: 'assistant', content: result.message }].slice(-12),
        })
        return result
      }
      if ((request.get('actionExpiresAt') as Timestamp).toMillis() <= Date.now())
        throw new HttpsError('failed-precondition', 'This action expired. Ask Jarvis again.')
      const action = request.get('action') as PreparedAction
      let entityId: string
      let commit: () => void
      if (action.kind === 'CREATE_TRANSACTION') {
        const payload = transactionInputSchema.parse(action.input)
        if (payload.householdId !== input.householdId)
          throw new HttpsError('permission-denied', 'Household mismatch.')
        const plan = await planTransactionCreation(transaction, payload, actor, action.entityId)
        entityId = plan.transactionId
        commit = plan.commit
      } else if (action.kind === 'CREATE_TASK') {
        const payload = createTaskSchema.parse(action.input)
        if (payload.householdId !== input.householdId)
          throw new HttpsError('permission-denied', 'Household mismatch.')
        const plan = await planTaskCreation(transaction, payload, actor)
        entityId = plan.taskId
        commit = plan.commit
      } else {
        const target = await transaction.get(
          db.doc(`households/${input.householdId}/transactions/${action.transactionId}`),
        )
        const updatedAt = target.get('updatedAt') as Timestamp | undefined
        if (
          !target.exists ||
          target.get('isDeleted') ||
          !updatedAt?.isEqual(action.expectedUpdatedAt)
        )
          throw new HttpsError(
            'aborted',
            'That transaction changed since the preview. Ask Jarvis to find it again.',
          )
        entityId = action.transactionId
        commit = await planTransactionDeletion(
          transaction,
          { householdId: input.householdId, transactionId: entityId },
          actor,
        )
      }
      const result: JarvisActionResult = {
        status: 'COMPLETED',
        entityId,
        message: `${action.kind === 'DELETE_TRANSACTION' ? (greek ? 'Διαγράφηκε' : 'Deleted') : greek ? 'Αποθηκεύτηκε' : 'Saved'}: ${action.summary}`,
      }
      commit()
      transaction.update(ref, { status: 'COMPLETED', result })
      const messages = (conversation.get('messages') as ChatMessage[]) ?? []
      transaction.update(session, {
        messages: [...messages, { role: 'assistant', content: result.message }].slice(-12),
      })
      return result
    })
  },
)
