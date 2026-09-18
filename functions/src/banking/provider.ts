export interface ProviderConnectionRequest {
  institutionId: string
  callbackUrl: string
}

export interface ProviderConnectionResult {
  providerConnectionId: string
  authorizationUrl?: string
}

export interface ProviderAccount {
  externalAccountId: string
  name: string
  currency: string
}

export interface ProviderTransaction {
  externalTransactionId: string
  externalAccountId: string
  description: string
  amountMinor: number
  currency: string
  bookingDate: string
  status: 'PENDING' | 'BOOKED'
}

export interface BankProvider {
  createConnection(request: ProviderConnectionRequest): Promise<ProviderConnectionResult>
  refreshConnection(providerConnectionId: string): Promise<void>
  fetchAccounts(providerConnectionId: string): Promise<ProviderAccount[]>
  fetchTransactions(providerConnectionId: string, from: string): Promise<ProviderTransaction[]>
  disconnect(providerConnectionId: string): Promise<void>
}

export class UnconfiguredOpenBankingProvider implements BankProvider {
  private unavailable(): never {
    throw new Error(
      'A regulated Open Banking provider and server-side credentials must be configured.',
    )
  }
  async createConnection(): Promise<ProviderConnectionResult> {
    return this.unavailable()
  }
  async refreshConnection(): Promise<void> {
    return this.unavailable()
  }
  async fetchAccounts(): Promise<ProviderAccount[]> {
    return this.unavailable()
  }
  async fetchTransactions(): Promise<ProviderTransaction[]> {
    return this.unavailable()
  }
  async disconnect(): Promise<void> {
    return this.unavailable()
  }
}
