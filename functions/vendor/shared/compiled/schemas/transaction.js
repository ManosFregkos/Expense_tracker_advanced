import { z } from 'zod';
import { TRANSACTION_SOURCES } from '../domain/types.js';
import { amountMinorSchema, currencySchema, idSchema, isoDateSchema, optionalTextSchema, shortTextSchema, } from './common.js';
const base = z.object({
    amountMinor: amountMinorSchema,
    currency: currencySchema,
    description: shortTextSchema,
    merchant: z.string().trim().max(160).optional(),
    transactionDate: isoDateSchema,
    notes: optionalTextSchema,
    source: z.enum(TRANSACTION_SOURCES).default('MANUAL'),
    bankTransactionId: idSchema.optional(),
});
const expenseIncomeFields = {
    accountId: idSchema,
    ownerUserId: idSchema,
    categoryId: idSchema,
};
export const transactionCoreSchema = z.discriminatedUnion('type', [
    base.extend({ type: z.literal('EXPENSE'), ...expenseIncomeFields }),
    base.extend({ type: z.literal('INCOME'), ...expenseIncomeFields }),
    base
        .extend({
        type: z.literal('TRANSFER'),
        sourceAccountId: idSchema,
        destinationAccountId: idSchema,
    })
        .refine((value) => value.sourceAccountId !== value.destinationAccountId, {
        message: 'Source and destination accounts must differ',
        path: ['destinationAccountId'],
    }),
]);
export const transactionInputSchema = z.intersection(z.object({ householdId: idSchema }), transactionCoreSchema);
export const updateTransactionSchema = z.object({
    householdId: idSchema,
    transactionId: idSchema,
    transaction: transactionCoreSchema,
});
export const transactionIdSchema = z.object({ householdId: idSchema, transactionId: idSchema });
