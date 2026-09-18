import type { MonthlyAnalytics, Transaction } from '../domain/types.js';
export type AnalyticsDelta = Omit<MonthlyAnalytics, 'currency' | 'monthKey' | 'updatedAt'>;
export declare function emptyAnalyticsDelta(): AnalyticsDelta;
export declare function transactionAnalyticsDelta(transaction: Transaction, direction?: 1 | -1): AnalyticsDelta;
export declare function accountEffects(transaction: Transaction, direction?: 1 | -1): Record<string, number>;
export declare function mergeAnalyticsDeltas(...deltas: AnalyticsDelta[]): AnalyticsDelta;
export declare function netCashflow(analytics: Pick<MonthlyAnalytics, 'incomeMinor' | 'expenseMinor'>): number;
export declare function percentageChange(current: number, previous: number): number | null;
export declare function averageMinor(values: number[]): number;
//# sourceMappingURL=analytics.d.ts.map