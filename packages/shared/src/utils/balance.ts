import type {
  AccountType,
  BankReportedBalance,
  FinancialAccount,
  Transaction,
} from '../domain/types.js'

export function transactionEffectForAccount(
  transaction: Transaction,
  accountId: string,
  accountType: AccountType,
): number {
  if (transaction.isDeleted || transaction.deletedAt || transaction.affectsBalance === false)
    return 0
  const credit = accountType === 'CREDIT_CARD'
  if (transaction.type === 'EXPENSE')
    return transaction.accountId === accountId ? transaction.amountMinor * (credit ? 1 : -1) : 0
  if (transaction.type === 'INCOME')
    return transaction.accountId === accountId ? transaction.amountMinor * (credit ? -1 : 1) : 0
  if (transaction.transfer.sourceAccountId === accountId)
    return transaction.amountMinor * (credit ? 1 : -1)
  if (transaction.transfer.destinationAccountId === accountId)
    return transaction.amountMinor * (credit ? -1 : 1)
  return 0
}

export class AccountBalanceService {
  static calculateAccountBalance(
    account: Pick<FinancialAccount, 'id' | 'type' | 'openingBalanceMinor'>,
    transactions: readonly Transaction[],
  ): number {
    return transactions.reduce(
      (balance, transaction) =>
        balance + transactionEffectForAccount(transaction, account.id, account.type),
      account.openingBalanceMinor,
    )
  }

  static calculateCreditCardOutstanding(
    openingOutstandingMinor: number,
    accountId: string,
    transactions: readonly Transaction[],
  ): number {
    return this.calculateAccountBalance(
      { id: accountId, type: 'CREDIT_CARD', openingBalanceMinor: openingOutstandingMinor },
      transactions,
    )
  }

  static calculateAvailableCredit(
    creditLimitMinor: number | undefined,
    outstandingMinor: number,
  ): number | undefined {
    return creditLimitMinor === undefined ? undefined : creditLimitMinor - outstandingMinor
  }

  static compareWithBankBalance(
    type: AccountType,
    appCalculatedMinor: number,
    bank: BankReportedBalance | undefined,
  ): number | undefined {
    const authoritative = type === 'CREDIT_CARD' ? bank?.outstandingMinor : bank?.currentMinor
    return authoritative === undefined ? undefined : authoritative - appCalculatedMinor
  }
}
