import { z } from 'zod';
import { amountMinorSchema, currencySchema, idSchema, isoDateSchema, shortTextSchema, } from './common.js';
export const processBankTransactionSchema = z.object({
    householdId: idSchema,
    bankConnectionId: idSchema,
    externalTransactionId: idSchema,
    accountId: idSchema,
    rawDescription: shortTextSchema,
    amountMinor: amountMinorSchema,
    currency: currencySchema,
    bookingDate: isoDateSchema,
    status: z.enum(['PENDING', 'BOOKED', 'REVERSED', 'CANCELLED']),
});
export const merchantRuleSchema = z.object({
    householdId: idSchema,
    matcherType: z.enum(['EXACT', 'CONTAINS', 'STARTS_WITH']),
    pattern: shortTextSchema,
    categoryId: idSchema,
    priority: z.number().int().min(-1000).max(1000).default(0),
});
export const updateMerchantRuleSchema = merchantRuleSchema.extend({
    merchantRuleId: idSchema,
    enabled: z.boolean().default(true),
});
export const deleteMerchantRuleSchema = z.object({
    householdId: idSchema,
    merchantRuleId: idSchema,
});
export const institutionCodeSchema = z.enum(['ALPHA_BANK', 'EUROBANK', 'NBG']);
export const createBankConnectionSchema = z.object({
    householdId: idSchema,
    institutionCode: institutionCodeSchema,
    returnTo: z.string().url().max(2048),
});
export const bankConnectionActionSchema = z.object({
    householdId: idSchema,
    connectionId: idSchema,
});
export const reconnectBankConnectionSchema = bankConnectionActionSchema.extend({
    returnTo: z.string().url().max(2048),
});
export const reviewBankTransactionSchema = z.object({
    householdId: idSchema,
    bankTransactionId: idSchema,
    action: z.enum(['MATCH', 'CREATE_SEPARATELY', 'IGNORE']),
    transactionId: idSchema.optional(),
    categoryId: idSchema.optional(),
});
