import { z } from 'zod';
import { ACCOUNT_TYPES } from '../domain/types.js';
import { currencySchema, idSchema, signedAmountMinorSchema, shortTextSchema } from './common.js';
export const createAccountSchema = z.object({
    householdId: idSchema,
    ownerUserId: idSchema,
    name: shortTextSchema,
    type: z.enum(ACCOUNT_TYPES),
    institution: z.string().trim().max(120).optional(),
    currency: currencySchema,
    openingBalanceMinor: signedAmountMinorSchema.default(0),
});
export const updateAccountSchema = z.object({
    householdId: idSchema,
    accountId: idSchema,
    name: shortTextSchema,
    institution: z.string().trim().max(120).optional(),
});
export const archiveAccountSchema = z.object({ householdId: idSchema, accountId: idSchema });
