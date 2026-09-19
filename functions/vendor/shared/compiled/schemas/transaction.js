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
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});
const expenseIncomeFields = {
    accountId: idSchema,
    ownerUserId: idSchema,
    categoryId: idSchema,
};
export const transactionCoreSchema = z
    .discriminatedUnion('type', [
    base.extend({
        type: z.literal('EXPENSE'),
        ...expenseIncomeFields,
        splits: z
            .array(z.object({ id: idSchema, categoryId: idSchema, amountMinor: amountMinorSchema }))
            .max(20)
            .optional(),
    }),
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
])
    .superRefine((value, context) => {
    if (value.type === 'EXPENSE' &&
        value.splits?.length &&
        value.splits.reduce((sum, split) => sum + split.amountMinor, 0) !== value.amountMinor)
        context.addIssue({
            code: 'custom',
            path: ['splits'],
            message: 'Split amounts must equal the transaction amount',
        });
});
export const transactionInputSchema = z.intersection(z.object({ householdId: idSchema }), transactionCoreSchema);
export const updateTransactionSchema = z.object({
    householdId: idSchema,
    transactionId: idSchema,
    transaction: transactionCoreSchema,
});
export const transactionIdSchema = z.object({ householdId: idSchema, transactionId: idSchema });
