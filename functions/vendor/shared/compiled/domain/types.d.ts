export declare const HOUSEHOLD_ROLES: readonly ["OWNER", "ADMIN", "MEMBER"];
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];
export declare const ACCOUNT_TYPES: readonly ["BANK", "CASH", "CREDIT_CARD", "DEBIT_CARD"];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export declare const TRANSACTION_TYPES: readonly ["EXPENSE", "INCOME", "TRANSFER"];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export declare const TRANSACTION_SOURCES: readonly ["MANUAL", "BANK_SYNC", "IMPORT"];
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];
export declare const INVITATION_STATUSES: readonly ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"];
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export declare const BANK_CONNECTION_STATUSES: readonly ["ACTIVE", "EXPIRED", "REQUIRES_REAUTH", "ERROR"];
export declare const OPEN_BANKING_CONNECTION_STATUSES: readonly ["CONNECTING", "ACTIVE", "SYNCING", "STALE", "REQUIRES_REAUTH", "ERROR", "DISCONNECTED"];
export type BankConnectionStatus = (typeof BANK_CONNECTION_STATUSES)[number];
export declare const BANK_TRANSACTION_STATUSES: readonly ["PENDING", "BOOKED", "REVERSED", "CANCELLED"];
export type BankTransactionStatus = (typeof BANK_TRANSACTION_STATUSES)[number];
export declare const BANK_PROCESSING_STATUSES: readonly ["UNPROCESSED", "NORMALIZED", "IGNORED", "ERROR"];
export type BankProcessingStatus = (typeof BANK_PROCESSING_STATUSES)[number];
export declare const AUDIT_ACTIONS: readonly ["CREATE_TRANSACTION", "UPDATE_TRANSACTION", "DELETE_TRANSACTION", "RESTORE_TRANSACTION", "CREATE_ACCOUNT", "UPDATE_ACCOUNT", "ARCHIVE_ACCOUNT", "CREATE_CATEGORY", "UPDATE_CATEGORY", "CREATE_INVITATION", "ACCEPT_INVITATION", "REVOKE_INVITATION", "MEMBER_ROLE_CHANGE", "UPDATE_HOUSEHOLD", "CREATE_BANK_CONNECTION", "PROCESS_BANK_TRANSACTION", "BANK_CONNECTION_CREATED", "BANK_CONNECTION_RECONNECTED", "BANK_CONNECTION_REFRESHED", "BANK_CONNECTION_DISCONNECTED", "BANK_TRANSACTION_IMPORTED", "BANK_TRANSACTION_MATCHED", "BANK_TRANSACTION_UNMATCHED", "CATEGORY_CREATED", "CATEGORY_UPDATED", "CATEGORY_ARCHIVED", "MERCHANT_RULE_CREATED", "MERCHANT_RULE_UPDATED", "MERCHANT_RULE_DELETED", "TRANSACTION_SPLIT_CREATED", "TASK_CREATED", "TASK_UPDATED", "TASK_COMPLETED", "TASK_REOPENED", "TASK_CANCELLED", "TASK_DELETED", "TASK_RESTORED", "TASK_ASSIGNED", "TASK_LIST_CREATED", "TASK_LIST_UPDATED", "TASK_LIST_ARCHIVED", "TASK_SUBTASK_CREATED", "TASK_SUBTASK_COMPLETED", "TASK_RECURRENCE_CREATED", "TASK_REMINDER_SENT"];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export declare const TASK_STATUSES: readonly ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export declare const TASK_PRIORITIES: readonly ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export declare const TASK_RECURRENCE_FREQUENCIES: readonly ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"];
export type TaskRecurrenceFrequency = (typeof TASK_RECURRENCE_FREQUENCIES)[number];
export declare const TASK_RECURRENCE_END_TYPES: readonly ["NEVER", "UNTIL_DATE", "AFTER_OCCURRENCES"];
export type TaskRecurrenceEndType = (typeof TASK_RECURRENCE_END_TYPES)[number];
export interface TimestampLike {
    readonly seconds: number;
    readonly nanoseconds: number;
    toDate(): Date;
}
export type StoredDate = TimestampLike | Date;
export interface User {
    id: string;
    email: string;
    displayName: string;
    photoURL?: string;
    locale?: string;
    householdIds?: string[];
    createdAt: StoredDate;
    updatedAt: StoredDate;
}
export interface Household {
    id: string;
    name: string;
    defaultCurrency: string;
    timeZone: string;
    createdBy: string;
    createdAt: StoredDate;
    updatedAt: StoredDate;
}
export interface HouseholdMember {
    userId: string;
    householdId: string;
    displayName: string;
    role: HouseholdRole;
    joinedAt: StoredDate;
}
export interface FinancialAccount {
    id: string;
    householdId: string;
    ownerUserId: string;
    name: string;
    type: AccountType;
    institution?: string;
    currency: string;
    openingBalanceMinor: number;
    /** Legacy alias retained for old readers. New code uses appCalculatedBalanceMinor. */
    currentBalanceMinor: number;
    appCalculatedBalanceMinor?: number;
    bankReportedBalance?: BankReportedBalance;
    bankConnectionId?: string;
    bankAccountLinkId?: string;
    isArchived: boolean;
    createdAt: StoredDate;
    updatedAt: StoredDate;
}
interface TransactionBase {
    id: string;
    householdId: string;
    amountMinor: number;
    currency: string;
    description: string;
    merchant?: string;
    transactionDate: StoredDate;
    notes?: string;
    source: TransactionSource;
    bankTransactionId?: string;
    bankTransactionIds?: string[];
    bankStatus?: BankTransactionStatus;
    /** False only for history imported before the initial bank balance anchor. */
    affectsBalance?: boolean;
    /** Used for balance-only bank credits such as card refunds/payments. */
    excludeFromAnalytics?: boolean;
    tags?: string[];
    splits?: TransactionSplit[];
    /** Denormalized solely for category reference checks. */
    splitCategoryIds?: string[];
    createdBy: string;
    searchPrefixes: string[];
    isDeleted: boolean;
    createdAt: StoredDate;
    updatedAt: StoredDate;
    deletedAt?: StoredDate;
    deletedBy?: string;
}
export interface ExpenseTransaction extends TransactionBase {
    type: 'EXPENSE';
    accountId: string;
    ownerUserId: string;
    categoryId: string;
}
export interface IncomeTransaction extends TransactionBase {
    type: 'INCOME';
    accountId: string;
    ownerUserId: string;
    categoryId: string;
}
export interface TransferTransaction extends TransactionBase {
    type: 'TRANSFER';
    transfer: {
        sourceAccountId: string;
        destinationAccountId: string;
    };
}
export type Transaction = ExpenseTransaction | IncomeTransaction | TransferTransaction;
export interface Category {
    id: string;
    householdId: string;
    name: string;
    parentCategoryId?: string;
    type: 'EXPENSE' | 'INCOME';
    icon?: string;
    color?: string;
    normalizedName?: string;
    origin?: 'SYSTEM' | 'CUSTOM';
    createdBy?: string;
    isSystem: boolean;
    isArchived: boolean;
    createdAt?: StoredDate;
    updatedAt?: StoredDate;
}
export interface Invitation {
    id: string;
    householdId: string;
    householdName: string;
    email: string;
    emailLower: string;
    role: Exclude<HouseholdRole, 'OWNER'>;
    invitedBy: string;
    status: InvitationStatus;
    createdAt: StoredDate;
    expiresAt: StoredDate;
    acceptedAt?: StoredDate;
    acceptedBy?: string;
}
export interface AuditLog {
    id: string;
    householdId: string;
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    timestamp: StoredDate;
    changes?: {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
    };
}
export interface TaskRecurrence {
    frequency: TaskRecurrenceFrequency;
    interval: number;
    daysOfWeek?: number[];
    customUnit?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
    endType: TaskRecurrenceEndType;
    untilDate?: StoredDate;
    untilDateKey?: string;
    maxOccurrences?: number;
}
/**
 * A recurring task document is one immutable occurrence after completion. Completing it creates
 * the next occurrence with a deterministic ID, preserving history and making retries idempotent.
 */
export interface HouseholdTask {
    id: string;
    householdId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeUserId?: string | null;
    assigneeDisplayName?: string | null;
    listId?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    dueAt?: StoredDate | null;
    reminderAt?: StoredDate | null;
    reminderOffsetMinutes?: number | null;
    reminderState?: 'PENDING' | 'SENT' | 'CANCELLED' | null;
    overdueReminderState?: 'PENDING' | 'SENT' | 'CANCELLED' | null;
    recurrence?: TaskRecurrence | null;
    tags: string[];
    searchPrefixes: string[];
    sortOrder: number;
    version: number;
    seriesId?: string | null;
    occurrenceNumber?: number | null;
    previousOccurrenceId?: string | null;
    nextOccurrenceId?: string | null;
    relatedTransactionId?: string | null;
    createdBy: string;
    createdAt: StoredDate;
    updatedAt: StoredDate;
    completedAt?: StoredDate | null;
    completedBy?: string | null;
    cancelledAt?: StoredDate | null;
    cancelledBy?: string | null;
    isDeleted: boolean;
    deletedAt?: StoredDate | null;
    deletedBy?: string | null;
}
export interface TaskList {
    id: string;
    householdId: string;
    name: string;
    normalizedName: string;
    icon?: string;
    color?: string;
    sortOrder: number;
    isArchived: boolean;
    createdBy: string;
    createdAt: StoredDate;
    updatedAt: StoredDate;
}
export interface TaskSubtask {
    id: string;
    householdId: string;
    taskId: string;
    title: string;
    isCompleted: boolean;
    sortOrder: number;
    completedAt?: StoredDate | null;
    completedBy?: string | null;
    createdAt: StoredDate;
    updatedAt: StoredDate;
}
export declare const TASK_ACTIVITY_ACTIONS: readonly ["CREATED", "UPDATED", "COMPLETED", "REOPENED", "CANCELLED", "DELETED", "RESTORED", "ASSIGNED", "DUE_DATE_CHANGED", "SUBTASK_CREATED", "SUBTASK_UPDATED", "SUBTASK_COMPLETED"];
export type TaskActivityAction = (typeof TASK_ACTIVITY_ACTIONS)[number];
export interface TaskActivity {
    id: string;
    householdId: string;
    taskId: string;
    userId: string;
    userDisplayName: string;
    action: TaskActivityAction;
    timestamp: StoredDate;
    metadata?: Record<string, string | number | boolean | null>;
}
export interface TaskNotificationSettings {
    householdId: string;
    dueReminders: boolean;
    assignmentNotifications: boolean;
    overdueReminders: boolean;
    updatedAt: StoredDate;
}
export interface TaskNotification {
    id: string;
    householdId: string;
    taskId: string;
    title: string;
    body: string;
    type: 'DUE' | 'ASSIGNED' | 'OVERDUE';
    createdAt: StoredDate;
    readAt?: StoredDate | null;
}
export interface BankConnection {
    id: string;
    householdId: string;
    ownerUserId: string;
    provider: 'SALT_EDGE' | 'MOCK';
    providerCustomerId?: string;
    institutionId: string;
    institutionCode?: string;
    institutionName?: string;
    status: (typeof OPEN_BANKING_CONNECTION_STATUSES)[number] | BankConnectionStatus;
    consentStatus?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN';
    /** Present only in legacy documents. Provider IDs are now server-only. */
    providerConnectionId?: string;
    accountCount?: number;
    lastSyncStartedAt?: StoredDate;
    lastSuccessfulSyncAt?: StoredDate;
    nextRefreshPossibleAt?: StoredDate;
    lastErrorCode?: string;
    lastErrorMessageSafe?: string;
    createdAt: StoredDate;
    updatedAt: StoredDate;
}
export interface BankTransaction {
    id: string;
    householdId: string;
    connectionId?: string;
    bankConnectionId?: string;
    providerTransactionId?: string;
    externalTransactionId?: string;
    providerAccountId?: string;
    accountId?: string;
    rawDescription: string;
    amountMinor: number;
    currency: string;
    merchantName?: string;
    direction?: 'DEBIT' | 'CREDIT';
    transactionDate?: StoredDate;
    bookingDate?: StoredDate;
    valueDate?: StoredDate;
    status: BankTransactionStatus;
    fingerprint?: string;
    reconciliationStatus?: 'UNMATCHED' | 'REVIEW' | 'AUTO_MATCHED' | 'USER_MATCHED' | 'CREATED' | 'IGNORED';
    reviewReason?: 'NEEDS_CATEGORY' | 'UNKNOWN_MERCHANT' | 'POSSIBLE_DUPLICATE' | 'PENDING_ISSUE';
    processingStatus?: BankProcessingStatus;
    normalizedTransactionId?: string;
    pendingPredecessorId?: string;
    suggestedTransactionId?: string;
    reconciliationScore?: number;
    affectsBalance?: boolean;
    rawProviderPayloadHash?: string;
    createdAt: StoredDate;
    updatedAt?: StoredDate;
}
export interface MerchantRule {
    id: string;
    householdId: string;
    matcherType: 'EXACT' | 'CONTAINS' | 'STARTS_WITH';
    pattern: string;
    normalizedPattern?: string;
    categoryId: string;
    priority?: number;
    enabled?: boolean;
    createdBy: string;
    createdAt: StoredDate;
    updatedAt?: StoredDate;
}
export interface FinancialInstitution {
    providerInstitutionId: string;
    code: string;
    name: string;
    countryCode: string;
    logoUrl?: string;
    supportedAccountTypes: AccountType[];
}
export interface BankReportedBalance {
    availableMinor?: number;
    currentMinor?: number;
    outstandingMinor?: number;
    creditLimitMinor?: number;
    currency: string;
    reportedAt: StoredDate;
}
export interface BankAccountLink {
    id: string;
    householdId: string;
    connectionId: string;
    financialAccountId: string;
    providerAccountId: string;
    institutionId: string;
    type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CARD' | 'OTHER';
    currency: string;
    displayName: string;
    maskedIdentifier?: string;
    last4?: string;
    lastSyncedAt?: StoredDate;
    createdAt: StoredDate;
    updatedAt: StoredDate;
}
export interface BalanceSnapshot {
    bankCurrentMinor?: number;
    bankAvailableMinor?: number;
    appCalculatedMinor: number;
    differenceMinor?: number;
    capturedAt: StoredDate;
}
export interface TransactionSplit {
    id: string;
    categoryId: string;
    amountMinor: number;
}
export interface Tag {
    id: string;
    householdId: string;
    name: string;
    normalizedName: string;
    createdBy: string;
    createdAt: StoredDate;
}
export interface MonthlyAnalytics {
    currency: string;
    monthKey: string;
    incomeMinor: number;
    expenseMinor: number;
    transactionCount: number;
    byCategory: Record<string, number>;
    byMember: Record<string, number>;
    byAccount: Record<string, number>;
    byMerchant: Record<string, number>;
    byTag?: Record<string, number>;
    updatedAt: StoredDate;
}
export {};
//# sourceMappingURL=types.d.ts.map