import { z } from 'zod';
export declare const processBankTransactionSchema: z.ZodObject<{
    householdId: z.ZodString;
    bankConnectionId: z.ZodString;
    externalTransactionId: z.ZodString;
    accountId: z.ZodString;
    rawDescription: z.ZodString;
    amountMinor: z.ZodNumber;
    currency: z.ZodString;
    bookingDate: z.ZodISODateTime;
    status: z.ZodEnum<{
        PENDING: "PENDING";
        BOOKED: "BOOKED";
    }>;
}, z.core.$strip>;
export declare const merchantRuleSchema: z.ZodObject<{
    householdId: z.ZodString;
    matcherType: z.ZodLiteral<"CONTAINS">;
    pattern: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    categoryId: z.ZodString;
}, z.core.$strip>;
export type ProcessBankTransactionInput = z.infer<typeof processBankTransactionSchema>;
//# sourceMappingURL=banking.d.ts.map