export const HOUSEHOLD_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number]

export const ACCOUNT_TYPES = ['BANK', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const TRANSACTION_TYPES = ['EXPENSE', 'INCOME', 'TRANSFER'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_SOURCES = ['MANUAL', 'BANK_SYNC', 'IMPORT'] as const
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number]

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] as const
export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

export const BANK_CONNECTION_STATUSES = ['ACTIVE', 'EXPIRED', 'REQUIRES_REAUTH', 'ERROR'] as const
export type BankConnectionStatus = (typeof BANK_CONNECTION_STATUSES)[number]

export const BANK_TRANSACTION_STATUSES = ['PENDING', 'BOOKED'] as const
export type BankTransactionStatus = (typeof BANK_TRANSACTION_STATUSES)[number]

export const BANK_PROCESSING_STATUSES = ['UNPROCESSED', 'NORMALIZED', 'IGNORED', 'ERROR'] as const
export type BankProcessingStatus = (typeof BANK_PROCESSING_STATUSES)[number]

export const AUDIT_ACTIONS = [
  'CREATE_TRANSACTION',
  'UPDATE_TRANSACTION',
  'DELETE_TRANSACTION',
  'RESTORE_TRANSACTION',
  'CREATE_ACCOUNT',
  'UPDATE_ACCOUNT',
  'ARCHIVE_ACCOUNT',
  'CREATE_CATEGORY',
  'UPDATE_CATEGORY',
  'CREATE_INVITATION',
  'ACCEPT_INVITATION',
  'REVOKE_INVITATION',
  'MEMBER_ROLE_CHANGE',
  'UPDATE_HOUSEHOLD',
  'CREATE_BANK_CONNECTION',
  'PROCESS_BANK_TRANSACTION',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface TimestampLike {
  readonly seconds: number
  readonly nanoseconds: number
  toDate(): Date
}

export type StoredDate = TimestampLike | Date

export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  locale?: string
  householdIds?: string[]
  createdAt: StoredDate
  updatedAt: StoredDate
}

export interface Household {
  id: string
  name: string
  defaultCurrency: string
  timeZone: string
  createdBy: string
  createdAt: StoredDate
  updatedAt: StoredDate
}

export interface HouseholdMember {
  userId: string
  householdId: string
  displayName: string
  role: HouseholdRole
  joinedAt: StoredDate
}

export interface FinancialAccount {
  id: string
  householdId: string
  ownerUserId: string
  name: string
  type: AccountType
  institution?: string
  currency: string
  openingBalanceMinor: number
  currentBalanceMinor: number
  isArchived: boolean
  createdAt: StoredDate
  updatedAt: StoredDate
}

interface TransactionBase {
  id: string
  householdId: string
  amountMinor: number
  currency: string
  description: string
  merchant?: string
  transactionDate: StoredDate
  notes?: string
  source: TransactionSource
  bankTransactionId?: string
  createdBy: string
  searchPrefixes: string[]
  isDeleted: boolean
  createdAt: StoredDate
  updatedAt: StoredDate
  deletedAt?: StoredDate
  deletedBy?: string
}

export interface ExpenseTransaction extends TransactionBase {
  type: 'EXPENSE'
  accountId: string
  ownerUserId: string
  categoryId: string
}

export interface IncomeTransaction extends TransactionBase {
  type: 'INCOME'
  accountId: string
  ownerUserId: string
  categoryId: string
}

export interface TransferTransaction extends TransactionBase {
  type: 'TRANSFER'
  transfer: { sourceAccountId: string; destinationAccountId: string }
}

export type Transaction = ExpenseTransaction | IncomeTransaction | TransferTransaction

export interface Category {
  id: string
  householdId: string
  name: string
  parentCategoryId?: string
  type: 'EXPENSE' | 'INCOME'
  icon?: string
  isSystem: boolean
  isArchived: boolean
}

export interface Invitation {
  id: string
  householdId: string
  householdName: string
  email: string
  emailLower: string
  role: Exclude<HouseholdRole, 'OWNER'>
  invitedBy: string
  status: InvitationStatus
  createdAt: StoredDate
  expiresAt: StoredDate
  acceptedAt?: StoredDate
  acceptedBy?: string
}

export interface AuditLog {
  id: string
  householdId: string
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  timestamp: StoredDate
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> }
}

export interface BankConnection {
  id: string
  householdId: string
  ownerUserId: string
  provider: string
  institutionId: string
  status: BankConnectionStatus
  providerConnectionId: string
  createdAt: StoredDate
  updatedAt: StoredDate
}

export interface BankTransaction {
  id: string
  householdId: string
  bankConnectionId: string
  externalTransactionId: string
  accountId: string
  rawDescription: string
  amountMinor: number
  currency: string
  bookingDate: StoredDate
  status: BankTransactionStatus
  processingStatus: BankProcessingStatus
  normalizedTransactionId?: string
  createdAt: StoredDate
}

export interface MerchantRule {
  id: string
  householdId: string
  matcherType: 'CONTAINS'
  pattern: string
  categoryId: string
  createdBy: string
  createdAt: StoredDate
}

export interface MonthlyAnalytics {
  currency: string
  monthKey: string
  incomeMinor: number
  expenseMinor: number
  transactionCount: number
  byCategory: Record<string, number>
  byMember: Record<string, number>
  byAccount: Record<string, number>
  byMerchant: Record<string, number>
  updatedAt: StoredDate
}
