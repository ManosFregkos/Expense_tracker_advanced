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
        REVERSED: "REVERSED";
        CANCELLED: "CANCELLED";
    }>;
}, z.core.$strip>;
export declare const merchantRuleSchema: z.ZodObject<{
    householdId: z.ZodString;
    matcherType: z.ZodEnum<{
        EXACT: "EXACT";
        CONTAINS: "CONTAINS";
        STARTS_WITH: "STARTS_WITH";
    }>;
    pattern: z.ZodString;
    categoryId: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateMerchantRuleSchema: z.ZodObject<{
    householdId: z.ZodString;
    matcherType: z.ZodEnum<{
        EXACT: "EXACT";
        CONTAINS: "CONTAINS";
        STARTS_WITH: "STARTS_WITH";
    }>;
    pattern: z.ZodString;
    categoryId: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    merchantRuleId: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const deleteMerchantRuleSchema: z.ZodObject<{
    householdId: z.ZodString;
    merchantRuleId: z.ZodString;
}, z.core.$strip>;
export declare const institutionCodeSchema: z.ZodEnum<{
    ALPHA_BANK: "ALPHA_BANK";
    EUROBANK: "EUROBANK";
    NBG: "NBG";
}>;
export declare const createBankConnectionSchema: z.ZodObject<{
    householdId: z.ZodString;
    institutionCode: z.ZodEnum<{
        ALPHA_BANK: "ALPHA_BANK";
        EUROBANK: "EUROBANK";
        NBG: "NBG";
    }>;
    returnTo: z.ZodString;
}, z.core.$strip>;
export declare const bankConnectionActionSchema: z.ZodObject<{
    householdId: z.ZodString;
    connectionId: z.ZodString;
}, z.core.$strip>;
export declare const reconnectBankConnectionSchema: z.ZodObject<{
    householdId: z.ZodString;
    connectionId: z.ZodString;
    returnTo: z.ZodString;
}, z.core.$strip>;
export declare const reviewBankTransactionSchema: z.ZodObject<{
    householdId: z.ZodString;
    bankTransactionId: z.ZodString;
    action: z.ZodEnum<{
        MATCH: "MATCH";
        CREATE_SEPARATELY: "CREATE_SEPARATELY";
        IGNORE: "IGNORE";
    }>;
    transactionId: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateBankConnectionInput = z.infer<typeof createBankConnectionSchema>;
export type ProcessBankTransactionInput = z.infer<typeof processBankTransactionSchema>;
//# sourceMappingURL=banking.d.ts.map