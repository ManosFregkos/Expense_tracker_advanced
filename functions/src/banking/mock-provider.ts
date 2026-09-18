import type {
  BankProvider,
  ProviderAccount,
  ProviderConnectionRequest,
  ProviderConnectionResult,
  ProviderTransaction,
} from './provider.js'

export class MockBankProvider implements BankProvider {
  readonly accounts: ProviderAccount[] = [
    { externalAccountId: 'mock-eurobank-current', name: 'Eurobank Current', currency: 'EUR' },
  ]
  readonly transactions: ProviderTransaction[] = []

  async createConnection(request: ProviderConnectionRequest): Promise<ProviderConnectionResult> {
    return { providerConnectionId: `mock:${request.institutionId}` }
  }
  async refreshConnection(_providerConnectionId: string): Promise<void> {}
  async fetchAccounts(_providerConnectionId: string): Promise<ProviderAccount[]> {
    return [...this.accounts]
  }
  async fetchTransactions(
    _providerConnectionId: string,
    _from: string,
  ): Promise<ProviderTransaction[]> {
    return [...this.transactions]
  }
  async disconnect(_providerConnectionId: string): Promise<void> {}
}
