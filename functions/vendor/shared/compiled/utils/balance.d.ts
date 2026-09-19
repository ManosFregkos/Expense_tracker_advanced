import type { AccountType, BankReportedBalance, FinancialAccount, Transaction } from '../domain/types.js';
export declare function transactionEffectForAccount(transaction: Transaction, accountId: string, accountType: AccountType): number;
export declare class AccountBalanceService {
    static calculateAccountBalance(account: Pick<FinancialAccount, 'id' | 'type' | 'openingBalanceMinor'>, transactions: readonly Transaction[]): number;
    static calculateCreditCardOutstanding(openingOutstandingMinor: number, accountId: string, transactions: readonly Transaction[]): number;
    static calculateAvailableCredit(creditLimitMinor: number | undefined, outstandingMinor: number): number | undefined;
    static compareWithBankBalance(type: AccountType, appCalculatedMinor: number, bank: BankReportedBalance | undefined): number | undefined;
}
//# sourceMappingURL=balance.d.ts.map