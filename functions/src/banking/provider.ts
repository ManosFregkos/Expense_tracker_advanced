export type ProviderConnectionStatus = 'ACTIVE' | 'INACTIVE' | 'DISABLED'
export type ProviderConsentStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN'

export interface ProviderCustomer {
  id: string
}
export interface ConnectSession {
  url: string
  expiresAt?: string
}
export interface RefreshResult {
  nextRefreshPossibleAt?: string
  authorizationUrl?: string
}
export interface RefreshInput {
  customFields: Record<string, string>
}
export interface ProviderConnection {
  id: string
  customerId: string
  institutionId: string
  institutionName: string
  status: ProviderConnectionStatus
  consentStatus: ProviderConsentStatus
  nextRefreshPossibleAt?: string
}
export interface ProviderBalance {
  currentMinor?: number
  availableMinor?: number
  outstandingMinor?: number
  creditLimitMinor?: number
  currency: string
  reportedAt: string
}
export interface ProviderAccount {
  id: string
  name: string
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CARD' | 'OTHER'
  currency: string
  maskedIdentifier?: string
  last4?: string
  balance: ProviderBalance
}
export interface ProviderTransaction {
  id: string
  accountId: string
  amountMinor: number
  direction: 'DEBIT' | 'CREDIT'
  currency: string
  description: string
  merchantName?: string
  transactionDate?: string
  bookingDate?: string
  valueDate?: string
  status: 'PENDING' | 'BOOKED' | 'REVERSED' | 'CANCELLED'
  providerReference?: string
  suggestedCategory?: string
  payloadHash?: string
}
export interface ConnectSessionInput {
  customerId: string
  institutionId: string
  returnTo: string
  customFields: Record<string, string>
}
export interface WebhookVerificationInput {
  callbackUrl: string
  rawBody: Buffer
  signature: string
  signatureKeyVersion?: string
}
export interface OpenBankingProvider {
  readonly name: 'SALT_EDGE' | 'MOCK'
  createCustomer(identifier: string): Promise<ProviderCustomer>
  createConnectSession(input: ConnectSessionInput): Promise<ConnectSession>
  createReconnectSession(
    connectionId: string,
    input: Omit<ConnectSessionInput, 'institutionId'>,
  ): Promise<ConnectSession>
  refreshConnection(connectionId: string, input?: RefreshInput): Promise<RefreshResult>
  getConnection(connectionId: string): Promise<ProviderConnection>
  getAccounts(connectionId: string): Promise<ProviderAccount[]>
  getTransactions(connectionId: string, fromDate: string): Promise<ProviderTransaction[]>
  disconnect(connectionId: string): Promise<void>
  verifyWebhook(input: WebhookVerificationInput): Promise<boolean>
}
export class ProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
