import { z } from 'zod';
export declare const createAccountSchema: z.ZodObject<{
    householdId: z.ZodString;
    ownerUserId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<{
        BANK: "BANK";
        CASH: "CASH";
        CREDIT_CARD: "CREDIT_CARD";
        DEBIT_CARD: "DEBIT_CARD";
    }>;
    institution: z.ZodOptional<z.ZodString>;
    currency: z.ZodString;
    openingBalanceMinor: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateAccountSchema: z.ZodObject<{
    householdId: z.ZodString;
    accountId: z.ZodString;
    name: z.ZodString;
    institution: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const archiveAccountSchema: z.ZodObject<{
    householdId: z.ZodString;
    accountId: z.ZodString;
}, z.core.$strip>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
//# sourceMappingURL=account.d.ts.map