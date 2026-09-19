export function transactionEffectForAccount(transaction, accountId, accountType) {
    if (transaction.isDeleted || transaction.deletedAt || transaction.affectsBalance === false)
        return 0;
    const credit = accountType === 'CREDIT_CARD';
    if (transaction.type === 'EXPENSE')
        return transaction.accountId === accountId ? transaction.amountMinor * (credit ? 1 : -1) : 0;
    if (transaction.type === 'INCOME')
        return transaction.accountId === accountId ? transaction.amountMinor * (credit ? -1 : 1) : 0;
    if (transaction.transfer.sourceAccountId === accountId)
        return transaction.amountMinor * (credit ? 1 : -1);
    if (transaction.transfer.destinationAccountId === accountId)
        return transaction.amountMinor * (credit ? -1 : 1);
    return 0;
}
export class AccountBalanceService {
    static calculateAccountBalance(account, transactions) {
        return transactions.reduce((balance, transaction) => balance + transactionEffectForAccount(transaction, account.id, account.type), account.openingBalanceMinor);
    }
    static calculateCreditCardOutstanding(openingOutstandingMinor, accountId, transactions) {
        return this.calculateAccountBalance({ id: accountId, type: 'CREDIT_CARD', openingBalanceMinor: openingOutstandingMinor }, transactions);
    }
    static calculateAvailableCredit(creditLimitMinor, outstandingMinor) {
        return creditLimitMinor === undefined ? undefined : creditLimitMinor - outstandingMinor;
    }
    static compareWithBankBalance(type, appCalculatedMinor, bank) {
        const authoritative = type === 'CREDIT_CARD' ? bank?.outstandingMinor : bank?.currentMinor;
        return authoritative === undefined ? undefined : authoritative - appCalculatedMinor;
    }
}
