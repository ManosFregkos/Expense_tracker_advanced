import { createHash, timingSafeEqual } from 'node:crypto'
import type {
  ConnectSession,
  ConnectSessionInput,
  OpenBankingProvider,
  ProviderAccount,
  ProviderConnection,
  ProviderCustomer,
  ProviderTransaction,
  RefreshResult,
  WebhookVerificationInput,
} from './provider.js'

const institutions: Record<string, string> = {
  ALPHA_BANK: 'Alpha Bank',
  EUROBANK: 'Eurobank',
  NBG: 'National Bank of Greece',
}

export class MockBankProvider implements OpenBankingProvider {
  readonly name = 'MOCK' as const
  readonly transactions: ProviderTransaction[] = []
  private readonly connectionInstitutions = new Map<string, string>()
  private readonly connectionCustomers = new Map<string, string>()
  private expired = false
  private refreshAfter = new Map<string, number>()
  private refreshCount = new Map<string, number>()

  async createCustomer(identifier: string): Promise<ProviderCustomer> {
    return {
      id: `mock-customer:${createHash('sha256').update(identifier).digest('hex').slice(0, 20)}`,
    }
  }
  async createConnectSession(input: ConnectSessionInput): Promise<ConnectSession> {
    const appConnectionId = input.customFields.appConnectionId ?? 'connection'
    const connectionId = `mock:${input.institutionId}:${appConnectionId}`
    this.connectionInstitutions.set(connectionId, input.institutionId)
    this.connectionCustomers.set(connectionId, input.customerId)
    const separator = input.returnTo.includes('?') ? '&' : '?'
    return {
      url: `${input.returnTo}${separator}mockConnectionId=${encodeURIComponent(connectionId)}&connectionId=${encodeURIComponent(appConnectionId)}`,
    }
  }
  async createReconnectSession(
    _connectionId: string,
    input: Omit<ConnectSessionInput, 'institutionId'>,
  ): Promise<ConnectSession> {
    this.expired = false
    return { url: `${input.returnTo}${input.returnTo.includes('?') ? '&' : '?'}reconnected=1` }
  }
  async refreshConnection(connectionId: string): Promise<RefreshResult> {
    const next = this.refreshAfter.get(connectionId) ?? 0
    if (next > Date.now()) return { nextRefreshPossibleAt: new Date(next).toISOString() }
    const eligible = Date.now() + 3 * 60_000
    this.refreshAfter.set(connectionId, eligible)
    this.refreshCount.set(connectionId, (this.refreshCount.get(connectionId) ?? 0) + 1)
    return { nextRefreshPossibleAt: new Date(eligible).toISOString() }
  }
  async getConnection(connectionId: string): Promise<ProviderConnection> {
    const expired = this.expired || process.env.MOCK_BANK_CONSENT === 'expired'
    const institutionId =
      this.connectionInstitutions.get(connectionId) ?? connectionId.split(':')[1] ?? 'ALPHA_BANK'
    return {
      id: connectionId,
      customerId: this.connectionCustomers.get(connectionId) ?? 'mock-customer',
      institutionId,
      institutionName: institutions[institutionId] ?? institutionId,
      status: expired ? 'INACTIVE' : 'ACTIVE',
      consentStatus: expired ? 'EXPIRED' : 'ACTIVE',
      nextRefreshPossibleAt: new Date(
        this.refreshAfter.get(connectionId) ?? Date.now(),
      ).toISOString(),
    }
  }
  async getAccounts(connectionId: string): Promise<ProviderAccount[]> {
    const institution =
      institutions[this.connectionInstitutions.get(connectionId) ?? 'ALPHA_BANK'] ?? 'Mock Bank'
    const reportedAt = new Date().toISOString()
    return [
      {
        id: `${connectionId}:current`,
        name: `${institution} Current`,
        type: 'CHECKING',
        currency: 'EUR',
        maskedIdentifier: '•••• 1024',
        last4: '1024',
        balance: { currentMinor: 284032, availableMinor: 272032, currency: 'EUR', reportedAt },
      },
      {
        id: `${connectionId}:card`,
        name: `${institution} Visa`,
        type: 'CREDIT_CARD',
        currency: 'EUR',
        maskedIdentifier: '•••• 4821',
        last4: '4821',
        balance: {
          outstandingMinor: 50000 + (this.refreshCount.get(connectionId) ?? 0) * 3500,
          availableMinor: 450000 - (this.refreshCount.get(connectionId) ?? 0) * 3500,
          creditLimitMinor: 500000,
          currency: 'EUR',
          reportedAt,
        },
      },
    ]
  }
  async getTransactions(connectionId: string, _fromDate: string): Promise<ProviderTransaction[]> {
    const custom = this.transactions.filter((transaction) =>
      transaction.accountId.startsWith(connectionId),
    )
    if (custom.length) return custom
    const date = new Date().toISOString().slice(0, 10)
    const booked = (this.refreshCount.get(connectionId) ?? 0) > 0
    const lidl: ProviderTransaction = {
      id: booked ? 'mock-lidl-booked' : 'mock-lidl-pending',
      accountId: `${connectionId}:card`,
      amountMinor: 3500,
      direction: 'DEBIT',
      currency: 'EUR',
      description: booked ? 'LIDL HELLAS 1342' : 'LIDL',
      merchantName: 'LIDL',
      transactionDate: date,
      ...(booked
        ? { bookingDate: date, status: 'BOOKED' as const }
        : { status: 'PENDING' as const }),
    }
    const bankOnly: ProviderTransaction = {
      id: 'mock-shell-booked',
      accountId: `${connectionId}:current`,
      amountMinor: 6500,
      direction: 'DEBIT',
      currency: 'EUR',
      description: 'SHELL ATHENS',
      merchantName: 'SHELL',
      transactionDate: date,
      bookingDate: date,
      status: 'BOOKED',
    }
    return [lidl, bankOnly, bankOnly]
  }
  async disconnect(connectionId: string): Promise<void> {
    this.connectionInstitutions.delete(connectionId)
  }
  async verifyWebhook(input: WebhookVerificationInput): Promise<boolean> {
    const expected = createHash('sha256').update(input.rawBody).digest('hex')
    const supplied = input.signature.replace(/^sha256=/, '')
    return (
      supplied.length === expected.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
  }
  expireConsent(): void {
    this.expired = true
  }
}
