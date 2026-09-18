export function emptyAnalyticsDelta() {
    return {
        incomeMinor: 0,
        expenseMinor: 0,
        transactionCount: 0,
        byCategory: {},
        byMember: {},
        byAccount: {},
        byMerchant: {},
    };
}
function addDimension(target, key, amount) {
    if (key)
        target[key] = (target[key] ?? 0) + amount;
}
export function transactionAnalyticsDelta(transaction, direction = 1) {
    const delta = emptyAnalyticsDelta();
    if (transaction.isDeleted || transaction.deletedAt || transaction.type === 'TRANSFER')
        return delta;
    const amount = transaction.amountMinor * direction;
    delta.transactionCount = direction;
    if (transaction.type === 'INCOME')
        delta.incomeMinor = amount;
    if (transaction.type === 'EXPENSE') {
        delta.expenseMinor = amount;
        addDimension(delta.byCategory, transaction.categoryId, amount);
        addDimension(delta.byMember, transaction.ownerUserId, amount);
        addDimension(delta.byAccount, transaction.accountId, amount);
        addDimension(delta.byMerchant, transaction.merchant?.trim().toLowerCase(), amount);
    }
    return delta;
}
export function accountEffects(transaction, direction = 1) {
    if (transaction.isDeleted || transaction.deletedAt)
        return {};
    if (transaction.type === 'EXPENSE')
        return { [transaction.accountId]: -transaction.amountMinor * direction };
    if (transaction.type === 'INCOME')
        return { [transaction.accountId]: transaction.amountMinor * direction };
    return {
        [transaction.transfer.sourceAccountId]: -transaction.amountMinor * direction,
        [transaction.transfer.destinationAccountId]: transaction.amountMinor * direction,
    };
}
export function mergeAnalyticsDeltas(...deltas) {
    const result = emptyAnalyticsDelta();
    for (const delta of deltas) {
        result.incomeMinor += delta.incomeMinor;
        result.expenseMinor += delta.expenseMinor;
        result.transactionCount += delta.transactionCount;
        for (const key of ['byCategory', 'byMember', 'byAccount', 'byMerchant']) {
            for (const [id, amount] of Object.entries(delta[key]))
                result[key][id] = (result[key][id] ?? 0) + amount;
        }
    }
    return result;
}
export function netCashflow(analytics) {
    return analytics.incomeMinor - analytics.expenseMinor;
}
export function percentageChange(current, previous) {
    if (previous === 0)
        return current === 0 ? 0 : null;
    return ((current - previous) / Math.abs(previous)) * 100;
}
export function averageMinor(values) {
    return values.length === 0
        ? 0
        : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
