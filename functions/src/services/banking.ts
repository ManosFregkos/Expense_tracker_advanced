import { createHash, randomUUID } from 'node:crypto'
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  buildSearchPrefixes,
  bankConnectionActionSchema,
  createBankConnectionSchema,
  householdIdSchema,
  normalizeSearchText,
  reconnectBankConnectionSchema,
  reviewBankTransactionSchema,
  type BankConnection,
  type BankTransaction,
  type Category,
  type FinancialAccount,
  type MerchantRule,
  type Transaction,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { getOpenBankingProvider } from '../banking/provider-factory.js'
import {
  ProviderError,
  type ProviderAccount,
  type ProviderTransaction,
} from '../banking/provider.js'
import { openBankingSecrets } from '../banking/secrets.js'
import {
  createImportedTransaction,
  reverseImportedTransaction,
  updateImportedTransactionFromBank,
} from './transactions.js'
import { requireMember } from './permissions.js'
import {
  matchesMerchantRule,
  TransactionReconciliationService,
  transactionFingerprint,
} from './reconciliation.js'

const MINIMUM_REFRESH_MS = 3 * 60_000
const LOCK_LEASE_MS = 10 * 60_000
const BANKING_CALLABLE_OPTIONS = {
  secrets: openBankingSecrets,
  timeoutSeconds: 300,
  memory: '512MiB' as const,
}
const INSTITUTIONS = {
  ALPHA_BANK: { name: 'Alpha Bank', env: 'SALTEDGE_ALPHA_PROVIDER_CODE' },
  EUROBANK: { name: 'Eurobank', env: 'SALTEDGE_EUROBANK_PROVIDER_CODE' },
  NBG: { name: 'National Bank of Greece', env: 'SALTEDGE_NBG_PROVIDER_CODE' },
} as const

type InstitutionCode = keyof typeof INSTITUTIONS
type PrivateConnection = {
  householdId: string
  ownerUserId: string
  providerCustomerId: string
  providerConnectionId?: string
}

export function bankTransactionDocumentId(
  connectionId: string,
  providerTransactionId: string,
): string {
  return createHash('sha256').update(`${connectionId}\u0000${providerTransactionId}`).digest('hex')
}
const bankAccountLinkId = (connectionId: string, providerAccountId: string) =>
  createHash('sha256').update(`${connectionId}\u0000${providerAccountId}`).digest('hex')
const normalizedTransactionId = (bankTransactionId: string) =>
  `bank-${bankTransactionId.slice(0, 28)}`
const publicRef = (householdId: string, connectionId: string) =>
  db.doc(`households/${householdId}/bankConnections/${connectionId}`)
const privateRef = (connectionId: string) => db.doc(`privateBankConnections/${connectionId}`)
async function writeBankAudit(
  householdId: string,
  userId: string,
  action:
    | 'BANK_CONNECTION_CREATED'
    | 'BANK_CONNECTION_RECONNECTED'
    | 'BANK_CONNECTION_REFRESHED'
    | 'BANK_CONNECTION_DISCONNECTED'
    | 'BANK_TRANSACTION_IMPORTED'
    | 'BANK_TRANSACTION_MATCHED'
    | 'BANK_TRANSACTION_UNMATCHED',
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const ref = db.collection(`households/${householdId}/auditLogs`).doc()
  try {
    await ref.set({
      id: ref.id,
      householdId,
      userId,
      action,
      entityType,
      entityId,
      timestamp: Timestamp.now(),
      changes: { after: details },
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        householdId,
        action,
        entityType,
        entityId,
        auditWriteFailed: true,
        error: error instanceof Error ? error.name : 'UNKNOWN',
      }),
    )
  }
}

function parseProviderDate(value: string | undefined): Timestamp | undefined {
  if (!value) return undefined
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : Timestamp.fromDate(date)
}

function safeError(error: unknown): {
  code: string
  message: string
  status: BankConnection['status']
} {
  if (error instanceof ProviderError) {
    const reauth = [
      'InvalidCredentials',
      'ConnectionInactive',
      'ConsentExpired',
      'ConsentRevoked',
    ].includes(error.code)
    return {
      code: error.code,
      message: reauth
        ? 'Bank authorization has expired. Reconnect to continue.'
        : error.retryable
          ? 'The bank is temporarily unavailable. Your previous data is safe.'
          : 'The bank connection could not be refreshed.',
      status: reauth ? 'REQUIRES_REAUTH' : 'ERROR',
    }
  }
  return {
    code: 'SYNC_FAILED',
    message: 'The bank connection could not be refreshed. Your previous data is safe.',
    status: 'ERROR',
  }
}

function validateReturnTo(value: string): void {
  const url = new URL(value)
  const configured = (process.env.OPEN_BANKING_ALLOWED_RETURN_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const local = process.env.FUNCTIONS_EMULATOR && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (!local && !configured.includes(url.origin))
    throw new HttpsError('invalid-argument', 'Return URL origin is not allowed.')
}

function resolveProviderInstitution(code: InstitutionCode): string {
  const provider = getOpenBankingProvider()
  if (provider.name === 'MOCK') return code
  const value = process.env[INSTITUTIONS[code].env]
  if (!value)
    throw new HttpsError(
      'failed-precondition',
      `${INSTITUTIONS[code].name} is not configured for this Salt Edge account.`,
    )
  return value
}

async function getOrCreateCustomer(uid: string): Promise<string> {
  const ref = db.doc(`privateOpenBankingCustomers/${uid}`)
  const existing = await ref.get()
  if (existing.exists) return String(existing.get('providerCustomerId'))
  const customer = await getOpenBankingProvider().createCustomer(`firebase:${uid}`)
  await ref
    .create({
      userId: uid,
      provider: getOpenBankingProvider().name,
      providerCustomerId: customer.id,
      createdAt: Timestamp.now(),
    })
    .catch(async (error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes('ALREADY_EXISTS')) throw error
    })
  const winner = await ref.get()
  return winner.exists ? String(winner.get('providerCustomerId')) : customer.id
}

async function loadPrivateConnection(
  householdId: string,
  connectionId: string,
): Promise<PrivateConnection> {
  const snapshot = await privateRef(connectionId).get()
  const value = snapshot.data() as PrivateConnection | undefined
  if (!value || value.householdId !== householdId)
    throw new HttpsError('not-found', 'Bank connection not found.')
  return value
}

async function acquireLock(householdId: string, connectionId: string): Promise<string> {
  const lockId = randomUUID()
  await db.runTransaction(async (transaction) => {
    const ref = publicRef(householdId, connectionId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Bank connection not found.')
    const expires = snapshot.get('syncLock.expiresAt') as Timestamp | undefined
    if (expires && expires.toMillis() > Date.now())
      throw new HttpsError('already-exists', 'This bank connection is already refreshing.')
    transaction.update(ref, {
      status: 'SYNCING',
      lastSyncStartedAt: Timestamp.now(),
      syncLock: {
        lockId,
        lockedAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + LOCK_LEASE_MS),
      },
      updatedAt: Timestamp.now(),
    })
  })
  return lockId
}

async function releaseLock(
  householdId: string,
  connectionId: string,
  lockId: string,
  update: DocumentData,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const ref = publicRef(householdId, connectionId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists || snapshot.get('syncLock.lockId') !== lockId) return
    transaction.update(ref, {
      ...update,
      syncLock: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    })
  })
}

function initialBalance(account: ProviderAccount): number {
  return account.type === 'CREDIT_CARD'
    ? (account.balance.outstandingMinor ?? 0)
    : (account.balance.currentMinor ?? 0)
}

async function upsertAccounts(
  householdId: string,
  connectionId: string,
  ownerUserId: string,
  institutionId: string,
  institutionName: string,
  accounts: ProviderAccount[],
): Promise<Map<string, FinancialAccount>> {
  const linksCollection = db.collection(`households/${householdId}/bankAccountLinks`)
  const existingLinks = await linksCollection.where('connectionId', '==', connectionId).get()
  const result = new Map<string, FinancialAccount>()
  for (const providerAccount of accounts) {
    const exact = existingLinks.docs.find(
      (doc) => doc.get('providerAccountId') === providerAccount.id,
    )
    const stableCandidates = existingLinks.docs.filter(
      (doc) =>
        providerAccount.last4 &&
        doc.get('last4') === providerAccount.last4 &&
        doc.get('type') === providerAccount.type &&
        doc.get('currency') === providerAccount.currency,
    )
    const stable = exact ?? (stableCandidates.length === 1 ? stableCandidates[0] : undefined)
    const linkRef =
      stable?.ref ?? linksCollection.doc(bankAccountLinkId(connectionId, providerAccount.id))
    const accountRef = stable
      ? db.doc(`households/${householdId}/accounts/${String(stable.get('financialAccountId'))}`)
      : db.collection(`households/${householdId}/accounts`).doc()
    await db.runTransaction(async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef)
      const now = Timestamp.now()
      const reportedAt = parseProviderDate(providerAccount.balance.reportedAt) ?? now
      const bankReportedBalance = { ...providerAccount.balance, reportedAt }
      if (!accountSnapshot.exists) {
        const opening = initialBalance(providerAccount)
        transaction.set(accountRef, {
          id: accountRef.id,
          householdId,
          ownerUserId,
          name: providerAccount.name,
          type:
            providerAccount.type === 'CHECKING' ||
            providerAccount.type === 'SAVINGS' ||
            providerAccount.type === 'OTHER'
              ? 'BANK'
              : providerAccount.type === 'CARD'
                ? 'DEBIT_CARD'
                : providerAccount.type,
          institution: institutionName,
          currency: providerAccount.currency,
          openingBalanceMinor: opening,
          currentBalanceMinor: opening,
          appCalculatedBalanceMinor: opening,
          bankReportedBalance,
          bankConnectionId: connectionId,
          bankAccountLinkId: linkRef.id,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        })
      } else
        transaction.update(accountRef, {
          name: providerAccount.name,
          bankReportedBalance,
          bankConnectionId: connectionId,
          bankAccountLinkId: linkRef.id,
          updatedAt: now,
        })
      const createdAt = stable ? (stable.get('createdAt') as Timestamp) : now
      transaction.set(linkRef, {
        id: linkRef.id,
        householdId,
        connectionId,
        financialAccountId: accountRef.id,
        providerAccountId: providerAccount.id,
        institutionId,
        type: providerAccount.type,
        currency: providerAccount.currency,
        displayName: providerAccount.name,
        ...(providerAccount.maskedIdentifier
          ? { maskedIdentifier: providerAccount.maskedIdentifier }
          : {}),
        ...(providerAccount.last4 ? { last4: providerAccount.last4 } : {}),
        lastSyncedAt: now,
        createdAt,
        updatedAt: now,
      })
      const snapshotRef = accountRef.collection('balanceSnapshots').doc(now.toMillis().toString())
      const appCalculatedMinor = accountSnapshot.exists
        ? Number(
            accountSnapshot.get('appCalculatedBalanceMinor') ??
              accountSnapshot.get('currentBalanceMinor') ??
              0,
          )
        : initialBalance(providerAccount)
      const bankCurrent =
        providerAccount.type === 'CREDIT_CARD'
          ? providerAccount.balance.outstandingMinor
          : providerAccount.balance.currentMinor
      transaction.set(snapshotRef, {
        ...(bankCurrent !== undefined
          ? { bankCurrentMinor: bankCurrent, differenceMinor: bankCurrent - appCalculatedMinor }
          : {}),
        ...(providerAccount.balance.availableMinor !== undefined
          ? { bankAvailableMinor: providerAccount.balance.availableMinor }
          : {}),
        appCalculatedMinor,
        capturedAt: now,
      })
    })
    const stored = await accountRef.get()
    if (stored.exists) result.set(providerAccount.id, stored.data() as FinancialAccount)
  }
  return result
}

function chooseMerchantRule(merchant: string, rules: MerchantRule[]): MerchantRule | undefined {
  const normalized = normalizeSearchText(merchant)
  const matcherRank = { EXACT: 3, STARTS_WITH: 2, CONTAINS: 1 } as const
  return [...rules]
    .filter((rule) => matchesMerchantRule(normalized, rule))
    .sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) ||
        matcherRank[b.matcherType] - matcherRank[a.matcherType] ||
        (b.normalizedPattern ?? b.pattern).length - (a.normalizedPattern ?? a.pattern).length ||
        a.id.localeCompare(b.id),
    )[0]
}

async function ensureFallbackCategory(
  householdId: string,
  type: 'EXPENSE' | 'INCOME',
): Promise<string> {
  const id = type === 'EXPENSE' ? 'expense-uncategorised' : 'income-uncategorised'
  const ref = db.doc(`households/${householdId}/categories/${id}`)
  const now = Timestamp.now()
  await ref.set(
    {
      id,
      householdId,
      name: 'Uncategorised',
      normalizedName: 'uncategorised',
      type,
      origin: 'SYSTEM',
      isSystem: true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )
  return id
}

function rawBankTransaction(
  householdId: string,
  connectionId: string,
  account: FinancialAccount,
  provider: ProviderTransaction,
): BankTransaction {
  const id = bankTransactionDocumentId(connectionId, provider.id)
  const date = parseProviderDate(provider.bookingDate ?? provider.transactionDate)
  const transactionDate = parseProviderDate(provider.transactionDate)
  const bookingDate = parseProviderDate(provider.bookingDate)
  const valueDate = parseProviderDate(provider.valueDate)
  return {
    id,
    householdId,
    connectionId,
    bankConnectionId: connectionId,
    providerTransactionId: provider.id,
    externalTransactionId: provider.id,
    providerAccountId: provider.accountId,
    accountId: account.id,
    rawDescription: provider.description,
    ...(provider.merchantName ? { merchantName: provider.merchantName } : {}),
    amountMinor: provider.amountMinor,
    direction: provider.direction,
    currency: provider.currency,
    ...(transactionDate ? { transactionDate } : {}),
    ...(bookingDate ? { bookingDate } : {}),
    ...(valueDate ? { valueDate } : {}),
    status: provider.status,
    fingerprint: transactionFingerprint({
      accountId: account.id,
      amountMinor: provider.amountMinor,
      currency: provider.currency,
      merchant: provider.merchantName ?? provider.description,
      ...(date ? { date: date.toDate() } : {}),
      direction: provider.direction,
    }),
    reconciliationStatus: 'UNMATCHED',
    ...(provider.status === 'PENDING' ? { reviewReason: 'PENDING_ISSUE' as const } : {}),
    ...(provider.payloadHash ? { rawProviderPayloadHash: provider.payloadHash } : {}),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}

async function transactionCandidates(
  householdId: string,
  bank: BankTransaction,
): Promise<Transaction[]> {
  if (!bank.accountId) return []
  const center = (bank.bookingDate ?? bank.transactionDate) as Timestamp | undefined
  if (!center) return []
  const start = Timestamp.fromMillis(center.toMillis() - 2 * 86_400_000)
  const end = Timestamp.fromMillis(center.toMillis() + 2 * 86_400_000)
  const snapshot = await db
    .collection(`households/${householdId}/transactions`)
    .where('accountId', '==', bank.accountId)
    .where('transactionDate', '>=', start)
    .where('transactionDate', '<=', end)
    .get()
  return snapshot.docs.map((doc) => doc.data() as Transaction)
}

async function findPendingPredecessor(
  connectionId: string,
  current: BankTransaction,
  allRaw: BankTransaction[],
): Promise<BankTransaction | undefined> {
  if (current.status !== 'BOOKED') return undefined
  const currentDate = (current.bookingDate ?? current.transactionDate) as Timestamp | undefined
  const options = allRaw.filter(
    (item) =>
      item.id !== current.id &&
      item.connectionId === connectionId &&
      item.status === 'PENDING' &&
      item.providerAccountId === current.providerAccountId &&
      item.amountMinor === current.amountMinor &&
      item.currency === current.currency &&
      item.direction === current.direction,
  )
  return options
    .map((item) => ({
      item,
      similarity:
        normalizeSearchText(item.merchantName ?? item.rawDescription) ===
        normalizeSearchText(current.merchantName ?? current.rawDescription)
          ? 1
          : 0,
      distance:
        currentDate && (item.transactionDate || item.bookingDate)
          ? Math.abs(
              currentDate.toMillis() -
                ((item.transactionDate ?? item.bookingDate) as Timestamp).toMillis(),
            )
          : Number.MAX_SAFE_INTEGER,
    }))
    .filter(({ distance }) => distance <= 4 * 86_400_000)
    .sort(
      (a, b) =>
        b.similarity - a.similarity ||
        a.distance - b.distance ||
        a.item.id.localeCompare(b.item.id),
    )[0]?.item
}

function uniqueProviderAccounts(accounts: ProviderAccount[]): ProviderAccount[] {
  const unique = new Map<string, ProviderAccount>()
  for (const account of accounts) {
    const existing = unique.get(account.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(account))
      throw new ProviderError(
        'INCONSISTENT_ACCOUNT',
        'Provider returned inconsistent account data.',
        false,
      )
    unique.set(account.id, account)
  }
  return [...unique.values()]
}

function uniqueProviderTransactions(
  transactions: ProviderTransaction[],
  accounts: ProviderAccount[],
): ProviderTransaction[] {
  const accountCurrencies = new Map(accounts.map((account) => [account.id, account.currency]))
  const unique = new Map<string, ProviderTransaction>()
  const statusRank = { PENDING: 0, BOOKED: 1, CANCELLED: 2, REVERSED: 3 } as const
  for (const bankTransaction of transactions) {
    if (
      accountCurrencies.get(bankTransaction.accountId) !== bankTransaction.currency ||
      !Number.isSafeInteger(bankTransaction.amountMinor) ||
      bankTransaction.amountMinor <= 0
    )
      throw new ProviderError(
        'MALFORMED_TRANSACTION',
        'Provider returned a transaction that does not match its account.',
        false,
      )
    const existing = unique.get(bankTransaction.id)
    if (
      existing &&
      (existing.accountId !== bankTransaction.accountId ||
        existing.amountMinor !== bankTransaction.amountMinor ||
        existing.currency !== bankTransaction.currency ||
        existing.direction !== bankTransaction.direction)
    )
      throw new ProviderError(
        'INCONSISTENT_TRANSACTION',
        'Provider reused a transaction identifier for different financial data.',
        false,
      )
    if (
      !existing ||
      statusRank[bankTransaction.status] > statusRank[existing.status] ||
      (statusRank[bankTransaction.status] === statusRank[existing.status] &&
        JSON.stringify(bankTransaction).localeCompare(JSON.stringify(existing)) < 0)
    )
      unique.set(bankTransaction.id, bankTransaction)
  }
  return [...unique.values()]
}

async function linkManual(
  householdId: string,
  bank: BankTransaction,
  transactionId: string,
  status: 'AUTO_MATCHED' | 'USER_MATCHED',
): Promise<void> {
  const bankRef = db.doc(`households/${householdId}/bankTransactions/${bank.id}`)
  const transactionRef = db.doc(`households/${householdId}/transactions/${transactionId}`)
  await db.runTransaction(async (transaction) => {
    const [bankSnapshot, normalized] = await Promise.all([
      transaction.get(bankRef),
      transaction.get(transactionRef),
    ])
    if (!bankSnapshot.exists || !normalized.exists)
      throw new HttpsError('not-found', 'Transaction was not found.')
    const storedBank = bankSnapshot.data() as BankTransaction
    const candidate = normalized.data() as Transaction
    const existingNormalized = storedBank.normalizedTransactionId
    if (existingNormalized && existingNormalized !== transactionId)
      throw new HttpsError('already-exists', 'This bank record is already linked.')
    const linked = normalized.get('bankTransactionId') as string | undefined
    if (linked && linked !== bank.id)
      throw new HttpsError(
        'already-exists',
        'This transaction is already linked to another bank record.',
      )
    const compatibleAccount =
      candidate.type === 'TRANSFER'
        ? storedBank.direction === 'DEBIT'
          ? candidate.transfer.sourceAccountId === storedBank.accountId
          : candidate.transfer.destinationAccountId === storedBank.accountId
        : candidate.accountId === storedBank.accountId
    const compatibleType =
      candidate.type === 'TRANSFER' ||
      (storedBank.direction === 'DEBIT'
        ? candidate.type === 'EXPENSE'
        : candidate.type === 'INCOME')
    if (
      candidate.isDeleted ||
      candidate.amountMinor !== storedBank.amountMinor ||
      candidate.currency !== storedBank.currency ||
      !compatibleAccount ||
      !compatibleType
    )
      throw new HttpsError(
        'failed-precondition',
        'The selected transaction does not match the bank amount, currency, account, or direction.',
      )
    transaction.update(transactionRef, {
      bankTransactionId: bank.id,
      bankStatus: bank.status,
      updatedAt: Timestamp.now(),
    })
    transaction.update(bankRef, {
      normalizedTransactionId: transactionId,
      reconciliationStatus: status,
      reviewReason: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    })
  })
}

async function importTransactions(
  householdId: string,
  connectionId: string,
  accounts: Map<string, FinancialAccount>,
  incoming: ProviderTransaction[],
  initialSync: boolean,
): Promise<void> {
  const [rawSnapshot, rulesSnapshot] = await Promise.all([
    db
      .collection(`households/${householdId}/bankTransactions`)
      .where('connectionId', '==', connectionId)
      .get(),
    db.collection(`households/${householdId}/merchantRules`).get(),
  ])
  const allRaw = rawSnapshot.docs.map((doc) => doc.data() as BankTransaction)
  const rules = rulesSnapshot.docs.map((doc) => doc.data() as MerchantRule)
  const reconciliation = new TransactionReconciliationService()
  const statusRank = { PENDING: 0, BOOKED: 1, REVERSED: 2, CANCELLED: 3 } as const
  const uniqueIncoming = [
    ...new Map(incoming.map((transaction) => [transaction.id, transaction])).values(),
  ].sort(
    (left, right) =>
      statusRank[left.status] - statusRank[right.status] || left.id.localeCompare(right.id),
  )
  const incomingIds = new Set(uniqueIncoming.map((transaction) => transaction.id))
  await Promise.all(
    allRaw
      .filter(
        (raw) =>
          raw.status === 'PENDING' &&
          (raw.providerTransactionId === undefined || !incomingIds.has(raw.providerTransactionId)),
      )
      .map((raw) =>
        db.doc(`households/${householdId}/bankTransactions/${raw.id}`).update({
          status: 'CANCELLED',
          reconciliationStatus: 'IGNORED',
          updatedAt: Timestamp.now(),
        }),
      ),
  )
  const pairedProviderIds = new Set<string>()
  for (const debit of uniqueIncoming) {
    if (debit.status !== 'BOOKED' || debit.direction !== 'DEBIT' || pairedProviderIds.has(debit.id))
      continue
    const source = accounts.get(debit.accountId)
    if (!source || source.type === 'CREDIT_CARD') continue
    const debitDate = parseProviderDate(debit.bookingDate ?? debit.transactionDate)?.toMillis()
    const matches = uniqueIncoming.filter((credit) => {
      const destination = accounts.get(credit.accountId)
      const creditDate = parseProviderDate(credit.bookingDate ?? credit.transactionDate)?.toMillis()
      const paymentSignal =
        (debit.providerReference && debit.providerReference === credit.providerReference) ||
        /\b(payment|card payment|transfer|πληρω)\b/i.test(
          `${debit.description} ${credit.description}`,
        )
      return (
        credit.status === 'BOOKED' &&
        credit.direction === 'CREDIT' &&
        destination?.type === 'CREDIT_CARD' &&
        Boolean(paymentSignal) &&
        credit.amountMinor === debit.amountMinor &&
        credit.currency === debit.currency &&
        debitDate !== undefined &&
        creditDate !== undefined &&
        Math.abs(debitDate - creditDate) <= 2 * 86_400_000
      )
    })
    if (matches.length !== 1) continue
    const credit = matches[0]
    if (!credit || pairedProviderIds.has(credit.id)) continue
    const reverseMatches = uniqueIncoming.filter(
      (candidate) =>
        candidate.status === 'BOOKED' &&
        candidate.direction === 'DEBIT' &&
        candidate.amountMinor === credit.amountMinor &&
        candidate.currency === credit.currency &&
        accounts.get(candidate.accountId)?.type !== 'CREDIT_CARD' &&
        Math.abs(
          (parseProviderDate(candidate.bookingDate ?? candidate.transactionDate)?.toMillis() ??
            Number.MAX_SAFE_INTEGER) -
            (parseProviderDate(credit.bookingDate ?? credit.transactionDate)?.toMillis() ?? 0),
        ) <=
          2 * 86_400_000,
    )
    if (reverseMatches.length !== 1) continue
    const destination = accounts.get(credit.accountId)
    if (!destination) continue
    const debitBank = rawBankTransaction(householdId, connectionId, source, debit)
    const creditBank = rawBankTransaction(householdId, connectionId, destination, credit)
    for (const raw of [debitBank, creditBank]) {
      const existing = allRaw.find((item) => item.id === raw.id)
      raw.createdAt = existing?.createdAt ?? raw.createdAt
      raw.affectsBalance = existing?.affectsBalance ?? !initialSync
      if (existing?.normalizedTransactionId)
        raw.normalizedTransactionId = existing.normalizedTransactionId
      if (existing?.reconciliationStatus) raw.reconciliationStatus = existing.reconciliationStatus
      await db.doc(`households/${householdId}/bankTransactions/${raw.id}`).set(raw, { merge: true })
    }
    pairedProviderIds.add(debit.id)
    pairedProviderIds.add(credit.id)
    if (debitBank.normalizedTransactionId || creditBank.normalizedTransactionId) {
      const linkedIds = new Set(
        [debitBank.normalizedTransactionId, creditBank.normalizedTransactionId].filter(
          (value): value is string => Boolean(value),
        ),
      )
      if (linkedIds.size !== 1)
        throw new ProviderError(
          'CONFLICTING_TRANSFER_LINK',
          'Bank payment sides are linked to different transactions.',
          false,
        )
      const linkedId = [...linkedIds][0]!
      const repairStatus = [debitBank, creditBank].some(
        (raw) =>
          raw.reconciliationStatus === 'AUTO_MATCHED' ||
          raw.reconciliationStatus === 'USER_MATCHED',
      )
        ? 'AUTO_MATCHED'
        : 'CREATED'
      const repair = db.batch()
      for (const raw of [debitBank, creditBank])
        repair.update(db.doc(`households/${householdId}/bankTransactions/${raw.id}`), {
          normalizedTransactionId: linkedId,
          reconciliationStatus: repairStatus,
          updatedAt: Timestamp.now(),
        })
      repair.update(db.doc(`households/${householdId}/transactions/${linkedId}`), {
        bankTransactionId: debitBank.id,
        bankTransactionIds: [debitBank.id, creditBank.id],
        bankStatus: 'BOOKED',
        updatedAt: Timestamp.now(),
      })
      await repair.commit()
      continue
    }
    const transactionDate = (debitBank.bookingDate ??
      debitBank.transactionDate ??
      Timestamp.now()) as Timestamp
    const candidates = await db
      .collection(`households/${householdId}/transactions`)
      .where(
        'transactionDate',
        '>=',
        Timestamp.fromMillis(transactionDate.toMillis() - 2 * 86_400_000),
      )
      .where(
        'transactionDate',
        '<=',
        Timestamp.fromMillis(transactionDate.toMillis() + 2 * 86_400_000),
      )
      .get()
    const manual = candidates.docs
      .map((doc) => doc.data() as Transaction)
      .filter(
        (candidate) =>
          candidate.type === 'TRANSFER' &&
          !candidate.isDeleted &&
          !candidate.bankTransactionId &&
          candidate.amountMinor === debit.amountMinor &&
          candidate.currency === debit.currency &&
          candidate.transfer.sourceAccountId === source.id &&
          candidate.transfer.destinationAccountId === destination.id,
      )
    if (manual.length > 1) {
      await Promise.all(
        [debitBank, creditBank].map((raw) =>
          db.doc(`households/${householdId}/bankTransactions/${raw.id}`).update({
            reconciliationStatus: 'REVIEW',
            reviewReason: 'POSSIBLE_DUPLICATE',
            updatedAt: Timestamp.now(),
          }),
        ),
      )
      continue
    }
    const transactionId =
      manual.length === 1
        ? manual[0]!.id
        : `bank-transfer-${createHash('sha256').update([debitBank.id, creditBank.id].sort().join('\u0000')).digest('hex').slice(0, 24)}`
    if (manual.length === 1) {
      await db.runTransaction(async (firestoreTransaction) => {
        const manualRef = db.doc(`households/${householdId}/transactions/${transactionId}`)
        const manualSnapshot = await firestoreTransaction.get(manualRef)
        const current = manualSnapshot.data() as Transaction | undefined
        if (
          !current ||
          current.isDeleted ||
          current.bankTransactionId ||
          current.type !== 'TRANSFER' ||
          current.amountMinor !== debit.amountMinor ||
          current.currency !== debit.currency ||
          current.transfer.sourceAccountId !== source.id ||
          current.transfer.destinationAccountId !== destination.id
        )
          throw new ProviderError(
            'TRANSFER_CHANGED_DURING_SYNC',
            'The matching transfer changed during synchronization.',
            true,
          )
        firestoreTransaction.update(manualRef, {
          bankTransactionId: debitBank.id,
          bankTransactionIds: [debitBank.id, creditBank.id],
          bankStatus: 'BOOKED',
          updatedAt: Timestamp.now(),
        })
        for (const raw of [debitBank, creditBank])
          firestoreTransaction.update(
            db.doc(`households/${householdId}/bankTransactions/${raw.id}`),
            {
              normalizedTransactionId: transactionId,
              reconciliationStatus: 'AUTO_MATCHED',
              reviewReason: FieldValue.delete(),
              updatedAt: Timestamp.now(),
            },
          )
      })
    } else {
      const now = Timestamp.now()
      const transfer: Transaction = {
        id: transactionId,
        householdId,
        type: 'TRANSFER',
        amountMinor: debit.amountMinor,
        currency: debit.currency,
        description: 'Credit card payment',
        transactionDate,
        transfer: { sourceAccountId: source.id, destinationAccountId: destination.id },
        source: 'BANK_SYNC',
        bankTransactionId: debitBank.id,
        bankTransactionIds: [debitBank.id, creditBank.id],
        bankStatus: 'BOOKED',
        createdBy: 'OPEN_BANKING_SYNC',
        searchPrefixes: buildSearchPrefixes('Credit card payment'),
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        ...(!debitBank.affectsBalance || !creditBank.affectsBalance
          ? { affectsBalance: false }
          : {}),
      }
      await createImportedTransaction(transfer)
      await Promise.all(
        [debitBank, creditBank].map((raw) =>
          db.doc(`households/${householdId}/bankTransactions/${raw.id}`).update({
            normalizedTransactionId: transactionId,
            reconciliationStatus: 'CREATED',
            reviewReason: FieldValue.delete(),
            updatedAt: Timestamp.now(),
          }),
        ),
      )
    }
    await writeBankAudit(
      householdId,
      manual.length === 1 ? manual[0]!.createdBy : 'OPEN_BANKING_SYNC',
      manual.length === 1 ? 'BANK_TRANSACTION_MATCHED' : 'BANK_TRANSACTION_IMPORTED',
      'TRANSFER',
      transactionId,
      { bankTransactionIds: [debitBank.id, creditBank.id] },
    )
  }
  for (const providerTransaction of uniqueIncoming) {
    if (pairedProviderIds.has(providerTransaction.id)) continue
    const account = accounts.get(providerTransaction.accountId)
    if (
      !account ||
      account.currency !== providerTransaction.currency ||
      !Number.isSafeInteger(providerTransaction.amountMinor) ||
      providerTransaction.amountMinor <= 0
    )
      continue
    const bank = rawBankTransaction(householdId, connectionId, account, providerTransaction)
    const ref = db.doc(`households/${householdId}/bankTransactions/${bank.id}`)
    const existing = allRaw.find((item) => item.id === bank.id)
    bank.affectsBalance = existing?.affectsBalance ?? !initialSync
    bank.createdAt = existing?.createdAt ?? bank.createdAt
    if (existing?.normalizedTransactionId)
      bank.normalizedTransactionId = existing.normalizedTransactionId
    if (existing?.reconciliationStatus) bank.reconciliationStatus = existing.reconciliationStatus
    const predecessor = await findPendingPredecessor(connectionId, bank, allRaw)
    if (predecessor) {
      bank.pendingPredecessorId = predecessor.id
      predecessor.status = 'CANCELLED'
      predecessor.reconciliationStatus = 'IGNORED'
      await db.doc(`households/${householdId}/bankTransactions/${predecessor.id}`).update({
        status: 'CANCELLED',
        reconciliationStatus: 'IGNORED',
        updatedAt: Timestamp.now(),
      })
    }
    await ref.set(bank, { merge: true })
    const cachedIndex = allRaw.findIndex((item) => item.id === bank.id)
    if (cachedIndex >= 0) allRaw[cachedIndex] = bank
    else allRaw.push(bank)
    if (existing?.normalizedTransactionId && bank.status === 'BOOKED') {
      const linkedRef = db.doc(
        `households/${householdId}/transactions/${existing.normalizedTransactionId}`,
      )
      const linkedSnapshot = await linkedRef.get()
      const linked = linkedSnapshot.data() as Transaction | undefined
      const bankDate = (bank.bookingDate ?? bank.transactionDate) as Timestamp | undefined
      const linkedDate =
        linked?.transactionDate instanceof Date
          ? linked.transactionDate
          : linked?.transactionDate.toDate()
      const materialMismatch =
        linked?.source === 'MANUAL' &&
        (linked.amountMinor !== bank.amountMinor ||
          linked.currency !== bank.currency ||
          (linked.type !== 'TRANSFER' && linked.accountId !== bank.accountId) ||
          (bankDate &&
            linkedDate &&
            Math.abs(bankDate.toMillis() - linkedDate.getTime()) > 2 * 86_400_000))
      if (materialMismatch) {
        await db.runTransaction(async (transaction) => {
          transaction.update(linkedRef, {
            bankTransactionId: FieldValue.delete(),
            bankStatus: FieldValue.delete(),
            updatedAt: Timestamp.now(),
          })
          transaction.update(ref, {
            normalizedTransactionId: FieldValue.delete(),
            reconciliationStatus: 'REVIEW',
            reviewReason: 'POSSIBLE_DUPLICATE',
            suggestedTransactionId: linkedRef.id,
            updatedAt: Timestamp.now(),
          })
        })
        delete bank.normalizedTransactionId
      }
      const date = (bank.bookingDate ?? bank.transactionDate) as Timestamp | undefined
      if (!materialMismatch && date)
        await updateImportedTransactionFromBank(householdId, existing.normalizedTransactionId, {
          amountMinor: bank.amountMinor,
          transactionDate: date,
          description: bank.rawDescription,
          ...(bank.merchantName ? { merchant: bank.merchantName } : {}),
          bankStatus: 'BOOKED',
        })
    }
    if (
      (bank.status === 'REVERSED' || bank.status === 'CANCELLED') &&
      bank.normalizedTransactionId
    ) {
      await reverseImportedTransaction(householdId, bank.normalizedTransactionId)
      await ref.update({ reconciliationStatus: 'IGNORED' })
      continue
    }
    if (bank.status === 'REVERSED' || bank.status === 'CANCELLED') {
      const original = allRaw
        .filter(
          (item) =>
            item.normalizedTransactionId &&
            item.providerAccountId === bank.providerAccountId &&
            item.amountMinor === bank.amountMinor &&
            item.currency === bank.currency &&
            normalizeSearchText(item.merchantName ?? item.rawDescription) ===
              normalizeSearchText(bank.merchantName ?? bank.rawDescription),
        )
        .sort(
          (a, b) =>
            (((b.bookingDate ?? b.transactionDate) as Timestamp | undefined)?.toMillis() ?? 0) -
            (((a.bookingDate ?? a.transactionDate) as Timestamp | undefined)?.toMillis() ?? 0),
        )[0]
      if (original?.normalizedTransactionId) {
        await reverseImportedTransaction(householdId, original.normalizedTransactionId)
        await ref.update({
          reconciliationStatus: 'IGNORED',
          reversedBankTransactionId: original.id,
        })
      }
      continue
    }
    if (bank.status !== 'BOOKED' || bank.normalizedTransactionId) continue
    const candidates = await transactionCandidates(householdId, bank)
    const decision = reconciliation.reconcileAutomatically(bank, candidates)
    if (decision.action === 'AUTO_MATCH' && decision.transactionId) {
      await linkManual(householdId, bank, decision.transactionId, 'AUTO_MATCHED')
      await writeBankAudit(
        householdId,
        'OPEN_BANKING_SYNC',
        'BANK_TRANSACTION_MATCHED',
        'BANK_TRANSACTION',
        bank.id,
        { normalizedTransactionId: decision.transactionId, method: 'AUTO' },
      )
      continue
    }
    if (decision.action === 'REVIEW') {
      await ref.update({
        reconciliationStatus: 'REVIEW',
        reviewReason: 'POSSIBLE_DUPLICATE',
        suggestedTransactionId: decision.transactionId,
        reconciliationScore: decision.score,
        updatedAt: Timestamp.now(),
      })
      await writeBankAudit(
        householdId,
        'OPEN_BANKING_SYNC',
        'BANK_TRANSACTION_UNMATCHED',
        'BANK_TRANSACTION',
        bank.id,
        { reason: 'POSSIBLE_DUPLICATE' },
      )
      continue
    }
    const rule = chooseMerchantRule(bank.merchantName ?? bank.rawDescription, rules)
    if (!rule) {
      await ref.update({
        reconciliationStatus: 'REVIEW',
        reviewReason: 'NEEDS_CATEGORY',
        updatedAt: Timestamp.now(),
      })
      await writeBankAudit(
        householdId,
        'OPEN_BANKING_SYNC',
        'BANK_TRANSACTION_UNMATCHED',
        'BANK_TRANSACTION',
        bank.id,
        { reason: 'NEEDS_CATEGORY' },
      )
      continue
    }
    const type = bank.direction === 'DEBIT' ? 'EXPENSE' : 'INCOME'
    const categoryId =
      type === 'EXPENSE' ? rule.categoryId : await ensureFallbackCategory(householdId, 'INCOME')
    const id = normalizedTransactionId(bank.id)
    const now = Timestamp.now()
    const date = (bank.bookingDate ?? bank.transactionDate ?? now) as Timestamp
    const normalized: Transaction = {
      id,
      householdId,
      type,
      amountMinor: bank.amountMinor,
      currency: bank.currency,
      accountId: account.id,
      ownerUserId: account.ownerUserId,
      categoryId,
      description: bank.rawDescription,
      ...(bank.merchantName ? { merchant: bank.merchantName } : {}),
      transactionDate: date,
      source: 'BANK_SYNC',
      bankTransactionId: bank.id,
      bankStatus: bank.status,
      createdBy: 'OPEN_BANKING_SYNC',
      searchPrefixes: buildSearchPrefixes(bank.rawDescription, bank.merchantName),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      ...(bank.affectsBalance === false ? { affectsBalance: false } : {}),
      ...(account.type === 'CREDIT_CARD' && bank.direction === 'CREDIT'
        ? { excludeFromAnalytics: true }
        : {}),
    } as Transaction
    await createImportedTransaction(normalized)
    await ref.update({
      normalizedTransactionId: id,
      reconciliationStatus: 'CREATED',
      reviewReason: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    })
    await writeBankAudit(
      householdId,
      'OPEN_BANKING_SYNC',
      'BANK_TRANSACTION_IMPORTED',
      'BANK_TRANSACTION',
      bank.id,
      { normalizedTransactionId: id },
    )
  }
}

export async function syncBankConnectionInternal(
  householdId: string,
  connectionId: string,
  requestRefresh: boolean,
): Promise<void> {
  const lockId = await acquireLock(householdId, connectionId)
  const started = Date.now()
  try {
    const privateConnection = await loadPrivateConnection(householdId, connectionId)
    const ownerMembership = await db
      .doc(`households/${householdId}/members/${privateConnection.ownerUserId}`)
      .get()
    if (!ownerMembership.exists)
      throw new ProviderError(
        'OWNER_REMOVED',
        'The connection owner is no longer a household member.',
        false,
      )
    if (!privateConnection.providerConnectionId)
      throw new ProviderError(
        'CONNECTION_PENDING',
        'Connection authorization is not complete.',
        false,
      )
    const provider = getOpenBankingProvider()
    const before = await publicRef(householdId, connectionId).get()
    const initialSync = !before.get('lastSuccessfulSyncAt')
    let refresh: Awaited<ReturnType<typeof provider.refreshConnection>> = {}
    if (requestRefresh)
      refresh = await provider.refreshConnection(privateConnection.providerConnectionId, {
        customFields: { appConnectionId: connectionId, householdId },
      })
    if (requestRefresh && provider.name === 'SALT_EDGE') {
      const nextRefresh = refresh.nextRefreshPossibleAt
        ? Timestamp.fromDate(new Date(refresh.nextRefreshPossibleAt))
        : Timestamp.fromMillis(Date.now() + MINIMUM_REFRESH_MS)
      await releaseLock(householdId, connectionId, lockId, {
        status: 'SYNCING',
        nextRefreshPossibleAt: nextRefresh,
        lastErrorCode: FieldValue.delete(),
        lastErrorMessageSafe: FieldValue.delete(),
      })
      console.info(
        JSON.stringify({
          correlationId: lockId,
          connectionId,
          householdId,
          provider: provider.name,
          syncStage: 'refresh_requested',
          durationMs: Date.now() - started,
          success: true,
        }),
      )
      return
    }
    const connection = await provider.getConnection(privateConnection.providerConnectionId)
    if (
      connection.consentStatus === 'EXPIRED' ||
      connection.consentStatus === 'REVOKED' ||
      connection.status !== 'ACTIVE'
    )
      throw new ProviderError(
        connection.consentStatus === 'REVOKED' ? 'ConsentRevoked' : 'ConsentExpired',
        'Consent is no longer active.',
        false,
      )
    const accounts = uniqueProviderAccounts(
      await provider.getAccounts(privateConnection.providerConnectionId),
    )
    const fromDate = new Date(
      initialSync ? Date.now() - 730 * 86_400_000 : Date.now() - 14 * 86_400_000,
    )
      .toISOString()
      .slice(0, 10)
    const transactions = uniqueProviderTransactions(
      await provider.getTransactions(privateConnection.providerConnectionId, fromDate),
      accounts,
    )
    const accountMap = await upsertAccounts(
      householdId,
      connectionId,
      privateConnection.ownerUserId,
      connection.institutionId,
      connection.institutionName,
      accounts,
    )
    await importTransactions(householdId, connectionId, accountMap, transactions, initialSync)
    const next = refresh.nextRefreshPossibleAt ?? connection.nextRefreshPossibleAt
    await releaseLock(householdId, connectionId, lockId, {
      status: 'ACTIVE',
      consentStatus: connection.consentStatus,
      institutionId: connection.institutionId,
      institutionName: connection.institutionName,
      accountCount: accounts.length,
      lastSuccessfulSyncAt: Timestamp.now(),
      ...(next ? { nextRefreshPossibleAt: Timestamp.fromDate(new Date(next)) } : {}),
      lastErrorCode: FieldValue.delete(),
      lastErrorMessageSafe: FieldValue.delete(),
    })
    await writeBankAudit(
      householdId,
      'OPEN_BANKING_SYNC',
      'BANK_CONNECTION_REFRESHED',
      'BANK_CONNECTION',
      connectionId,
      { accountCount: accounts.length, transactionCount: transactions.length },
    )
    console.info(
      JSON.stringify({
        correlationId: lockId,
        connectionId,
        householdId,
        provider: provider.name,
        institution: connection.institutionId,
        syncStage: 'complete',
        durationMs: Date.now() - started,
        success: true,
      }),
    )
  } catch (error) {
    const safe = safeError(error)
    await releaseLock(householdId, connectionId, lockId, {
      status: safe.status,
      ...(safe.status === 'REQUIRES_REAUTH' ? { consentStatus: 'EXPIRED' } : {}),
      ...(error instanceof ProviderError && error.retryAfterMs
        ? { nextRefreshPossibleAt: Timestamp.fromMillis(Date.now() + error.retryAfterMs) }
        : {}),
      lastErrorCode: safe.code,
      lastErrorMessageSafe: safe.message,
    })
    console.error(
      JSON.stringify({
        correlationId: lockId,
        connectionId,
        householdId,
        provider: getOpenBankingProvider().name,
        syncStage: 'failed',
        durationMs: Date.now() - started,
        success: false,
        errorCode: safe.code,
      }),
    )
    throw error
  }
}

export const createBankConnection = secureCallable(
  createBankConnectionSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
    validateReturnTo(input.returnTo)
    const duplicate = await db
      .collection(`households/${input.householdId}/bankConnections`)
      .where('ownerUserId', '==', actor.uid)
      .where('institutionCode', '==', input.institutionCode)
      .get()
    const reusable = duplicate.docs
      .filter((doc) => doc.get('status') === 'DISCONNECTED')
      .sort(
        (left, right) =>
          ((right.get('updatedAt') as Timestamp | undefined)?.toMillis() ?? 0) -
          ((left.get('updatedAt') as Timestamp | undefined)?.toMillis() ?? 0),
      )[0]
    if (duplicate.docs.some((doc) => doc.get('status') !== 'DISCONNECTED'))
      throw new HttpsError(
        'already-exists',
        'This bank is already connected. Use Reconnect if authorization expired.',
      )
    const provider = getOpenBankingProvider()
    const providerCustomerId = await getOrCreateCustomer(actor.uid)
    const connectionRef =
      reusable?.ref ?? db.collection(`households/${input.householdId}/bankConnections`).doc()
    const institution = INSTITUTIONS[input.institutionCode]
    const now = Timestamp.now()
    const batch = db.batch()
    batch.set(
      connectionRef,
      {
        id: connectionRef.id,
        householdId: input.householdId,
        ownerUserId: actor.uid,
        provider: provider.name,
        institutionCode: input.institutionCode,
        institutionId: resolveProviderInstitution(input.institutionCode),
        institutionName: institution.name,
        status: 'CONNECTING',
        consentStatus: 'UNKNOWN',
        accountCount: 0,
        createdAt: (reusable?.get('createdAt') as Timestamp | undefined) ?? now,
        updatedAt: now,
        lastErrorCode: FieldValue.delete(),
        lastErrorMessageSafe: FieldValue.delete(),
        syncLock: FieldValue.delete(),
      },
      { merge: true },
    )
    batch.set(
      privateRef(connectionRef.id),
      {
        householdId: input.householdId,
        ownerUserId: actor.uid,
        providerCustomerId,
        providerConnectionId: FieldValue.delete(),
        createdAt:
          (reusable
            ? ((await privateRef(connectionRef.id).get()).get('createdAt') as Timestamp | undefined)
            : undefined) ?? now,
        updatedAt: now,
      },
      { merge: true },
    )
    await batch.commit()
    let session: Awaited<ReturnType<typeof provider.createConnectSession>>
    try {
      session = await provider.createConnectSession({
        customerId: providerCustomerId,
        institutionId: resolveProviderInstitution(input.institutionCode),
        returnTo: input.returnTo,
        customFields: { appConnectionId: connectionRef.id, householdId: input.householdId },
      })
    } catch (error) {
      const safe = safeError(error)
      await connectionRef.update({
        status: safe.status,
        lastErrorCode: safe.code,
        lastErrorMessageSafe: safe.message,
        updatedAt: Timestamp.now(),
      })
      throw new HttpsError('unavailable', safe.message)
    }
    if (provider.name === 'MOCK') {
      const providerConnectionId = new URL(session.url).searchParams.get('mockConnectionId')
      if (providerConnectionId) {
        await privateRef(connectionRef.id).update({
          providerConnectionId,
          updatedAt: Timestamp.now(),
        })
        await syncBankConnectionInternal(input.householdId, connectionRef.id, false)
      }
    }
    await writeBankAudit(
      input.householdId,
      actor.uid,
      'BANK_CONNECTION_CREATED',
      'BANK_CONNECTION',
      connectionRef.id,
      { institutionId: input.institutionCode, provider: provider.name },
    )
    return { connectionId: connectionRef.id, authorizationUrl: session.url }
  },
  true,
  BANKING_CALLABLE_OPTIONS,
)

export const syncBankConnection = secureCallable(
  bankConnectionActionSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
    const connection = await publicRef(input.householdId, input.connectionId).get()
    if (!connection.exists) throw new HttpsError('not-found', 'Bank connection not found.')
    const next = connection.get('nextRefreshPossibleAt') as Timestamp | undefined
    const last = connection.get('lastSyncStartedAt') as Timestamp | undefined
    const eligibleAt = Math.max(next?.toMillis() ?? 0, (last?.toMillis() ?? 0) + MINIMUM_REFRESH_MS)
    if (eligibleAt > Date.now())
      throw new HttpsError(
        'resource-exhausted',
        `Bank data can be refreshed again in ${Math.ceil((eligibleAt - Date.now()) / 60_000)} minute(s).`,
      )
    try {
      await syncBankConnectionInternal(input.householdId, input.connectionId, true)
    } catch (error) {
      if (error instanceof HttpsError) throw error
      throw new HttpsError(
        error instanceof ProviderError && error.code === 'OWNER_REMOVED'
          ? 'permission-denied'
          : 'unavailable',
        safeError(error).message,
      )
    }
    return { connectionId: input.connectionId }
  },
  true,
  BANKING_CALLABLE_OPTIONS,
)

export const reconnectBankConnection = secureCallable(
  reconnectBankConnectionSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
    validateReturnTo(input.returnTo)
    const connection = await loadPrivateConnection(input.householdId, input.connectionId)
    if (!connection.providerConnectionId)
      throw new HttpsError('failed-precondition', 'Connection setup has not completed.')
    const bankingProvider = getOpenBankingProvider()
    let session: Awaited<ReturnType<typeof bankingProvider.createReconnectSession>>
    try {
      session = await bankingProvider.createReconnectSession(connection.providerConnectionId, {
        customerId: connection.providerCustomerId,
        returnTo: input.returnTo,
        customFields: { appConnectionId: input.connectionId, householdId: input.householdId },
      })
    } catch (error) {
      throw new HttpsError('unavailable', safeError(error).message)
    }
    await publicRef(input.householdId, input.connectionId).update({
      status: 'CONNECTING',
      updatedAt: Timestamp.now(),
    })
    await writeBankAudit(
      input.householdId,
      actor.uid,
      'BANK_CONNECTION_RECONNECTED',
      'BANK_CONNECTION',
      input.connectionId,
    )
    return { authorizationUrl: session.url }
  },
  true,
  BANKING_CALLABLE_OPTIONS,
)

export const disconnectBankConnection = secureCallable(
  bankConnectionActionSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
    const connection = await loadPrivateConnection(input.householdId, input.connectionId)
    if (connection.providerConnectionId) {
      try {
        await getOpenBankingProvider().disconnect(connection.providerConnectionId)
      } catch (error) {
        throw new HttpsError('unavailable', safeError(error).message)
      }
    }
    await publicRef(input.householdId, input.connectionId).update({
      status: 'DISCONNECTED',
      consentStatus: 'REVOKED',
      updatedAt: Timestamp.now(),
    })
    await writeBankAudit(
      input.householdId,
      actor.uid,
      'BANK_CONNECTION_DISCONNECTED',
      'BANK_CONNECTION',
      input.connectionId,
    )
    return { connectionId: input.connectionId }
  },
  true,
  BANKING_CALLABLE_OPTIONS,
)

export const reviewBankTransaction = secureCallable(
  reviewBankTransactionSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid)
    const ref = db.doc(
      `households/${input.householdId}/bankTransactions/${input.bankTransactionId}`,
    )
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'Bank transaction not found.')
    const bank = snapshot.data() as BankTransaction
    if (input.action === 'IGNORE') {
      await ref.update({
        reconciliationStatus: 'IGNORED',
        reviewReason: FieldValue.delete(),
        updatedAt: Timestamp.now(),
      })
      return { bankTransactionId: input.bankTransactionId }
    }
    if (input.action === 'MATCH') {
      if (!input.transactionId)
        throw new HttpsError('invalid-argument', 'Select a transaction to match.')
      await linkManual(input.householdId, bank, input.transactionId, 'USER_MATCHED')
      await writeBankAudit(
        input.householdId,
        actor.uid,
        'BANK_TRANSACTION_MATCHED',
        'BANK_TRANSACTION',
        bank.id,
        { normalizedTransactionId: input.transactionId, method: 'USER' },
      )
      return { bankTransactionId: input.bankTransactionId }
    }
    if (!input.categoryId || !bank.accountId)
      throw new HttpsError('invalid-argument', 'Select a category.')
    const [categorySnapshot, accountSnapshot] = await Promise.all([
      db.doc(`households/${input.householdId}/categories/${input.categoryId}`).get(),
      db.doc(`households/${input.householdId}/accounts/${bank.accountId}`).get(),
    ])
    if (!categorySnapshot.exists || !accountSnapshot.exists)
      throw new HttpsError('failed-precondition', 'Category or account is unavailable.')
    const category = categorySnapshot.data() as Category
    const account = accountSnapshot.data() as FinancialAccount
    const type = bank.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE'
    if (category.type !== type || category.isArchived)
      throw new HttpsError('failed-precondition', 'Category does not match this transaction.')
    const now = Timestamp.now()
    const id = normalizedTransactionId(bank.id)
    const normalized: Transaction = {
      id,
      householdId: input.householdId,
      type,
      amountMinor: bank.amountMinor,
      currency: bank.currency,
      accountId: account.id,
      ownerUserId: account.ownerUserId,
      categoryId: input.categoryId,
      description: bank.rawDescription,
      ...(bank.merchantName ? { merchant: bank.merchantName } : {}),
      transactionDate: (bank.bookingDate ?? bank.transactionDate ?? now) as Timestamp,
      source: 'BANK_SYNC',
      bankTransactionId: bank.id,
      bankStatus: bank.status,
      createdBy: actor.uid,
      searchPrefixes: buildSearchPrefixes(bank.rawDescription, bank.merchantName),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      ...(bank.affectsBalance === false ? { affectsBalance: false } : {}),
      ...(account.type === 'CREDIT_CARD' && bank.direction === 'CREDIT'
        ? { excludeFromAnalytics: true }
        : {}),
    }
    await createImportedTransaction(normalized)
    await ref.update({
      normalizedTransactionId: id,
      reconciliationStatus: 'CREATED',
      reviewReason: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    })
    await writeBankAudit(
      input.householdId,
      actor.uid,
      'BANK_TRANSACTION_IMPORTED',
      'BANK_TRANSACTION',
      bank.id,
      { normalizedTransactionId: id },
    )
    return { bankTransactionId: input.bankTransactionId }
  },
)

export const processBankTransaction = secureCallable(householdIdSchema, async (_input, _actor) => {
  throw new HttpsError(
    'failed-precondition',
    'Direct bank transaction ingestion is disabled. Use the verified provider synchronization pipeline.',
  )
})
