import { z } from 'zod';
export declare const transactionCoreSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    amountMinor: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodString;
    merchant: z.ZodOptional<z.ZodString>;
    transactionDate: z.ZodISODateTime;
    notes: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        BANK_SYNC: "BANK_SYNC";
        IMPORT: "IMPORT";
    }>>;
    bankTransactionId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    splits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        categoryId: z.ZodString;
        amountMinor: z.ZodNumber;
    }, z.core.$strip>>>;
    accountId: z.ZodString;
    ownerUserId: z.ZodString;
    categoryId: z.ZodString;
    type: z.ZodLiteral<"EXPENSE">;
}, z.core.$strip>, z.ZodObject<{
    amountMinor: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodString;
    merchant: z.ZodOptional<z.ZodString>;
    transactionDate: z.ZodISODateTime;
    notes: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        BANK_SYNC: "BANK_SYNC";
        IMPORT: "IMPORT";
    }>>;
    bankTransactionId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    accountId: z.ZodString;
    ownerUserId: z.ZodString;
    categoryId: z.ZodString;
    type: z.ZodLiteral<"INCOME">;
}, z.core.$strip>, z.ZodObject<{
    amountMinor: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodString;
    merchant: z.ZodOptional<z.ZodString>;
    transactionDate: z.ZodISODateTime;
    notes: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        BANK_SYNC: "BANK_SYNC";
        IMPORT: "IMPORT";
    }>>;
    bankTransactionId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    type: z.ZodLiteral<"TRANSFER">;
    sourceAccountId: z.ZodString;
    destinationAccountId: z.ZodString;
}, z.core.$strip>], "type">;
export declare const transactionInputSchema: z.ZodIntersection<z.ZodObject<{
    householdId: z.ZodString;
}, z.core.$strip>, z.ZodDiscriminatedUnion<[z.ZodObject<{
    amountMinor: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodString;
    merchant: z.ZodOptional<z.ZodString>;
    transactionDate: z.ZodISODateTime;
    notes: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        BANK_SYNC: "BANK_SYNC";
        IMPORT: "IMPORT";
    }>>;
    bankTransactionId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    splits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        categoryId: z.ZodString;
        amountMinor: z.ZodNumber;
    }, z.core.$strip>>>;
    accountId: z.ZodString;
    ownerUserId: z.ZodString;
    categoryId: z.ZodString;
    type: z.ZodLiteral<"EXPENSE">;
}, z.core.$strip>, z.ZodObject<{
    amountMinor: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodString;
    merchant: z.ZodOptional<z.ZodString>;
    transactionDate: z.ZodISODateTime;
    notes: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        BANK_SYNC: "BANK_SYNC";
        IMPORT: "IMPORT";
    }>>;
    bankTransactionId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    accountId: z.ZodString;
    ownerUserId: z.ZodString;
    categoryId: z.ZodString;
    type: z.ZodLiteral<"INCOME">;
}, z.core.$strip>, z.ZodObject<{
    amountMinor: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodString;
    merchant: z.ZodOptional<z.ZodString>;
    transactionDate: z.ZodISODateTime;
    notes: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        BANK_SYNC: "BANK_SYNC";
        IMPORT: "IMPORT";
    }>>;
    bankTransactionId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    type: z.ZodLiteral<"TRANSFER">;
    sourceAccountId: z.ZodString;
    destinationAccountId: z.ZodString;
}, z.core.$strip>], "type">>;
export declare const updateTransactionSchema: z.ZodObject<{
    householdId: z.ZodString;
    transactionId: z.ZodString;
    transaction: z.ZodDiscriminatedUnion<[z.ZodObject<{
        amountMinor: z.ZodNumber;
        currency: z.ZodString;
        description: z.ZodString;
        merchant: z.ZodOptional<z.ZodString>;
        transactionDate: z.ZodISODateTime;
        notes: z.ZodOptional<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<{
            MANUAL: "MANUAL";
            BANK_SYNC: "BANK_SYNC";
            IMPORT: "IMPORT";
        }>>;
        bankTransactionId: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        splits: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            categoryId: z.ZodString;
            amountMinor: z.ZodNumber;
        }, z.core.$strip>>>;
        accountId: z.ZodString;
        ownerUserId: z.ZodString;
        categoryId: z.ZodString;
        type: z.ZodLiteral<"EXPENSE">;
    }, z.core.$strip>, z.ZodObject<{
        amountMinor: z.ZodNumber;
        currency: z.ZodString;
        description: z.ZodString;
        merchant: z.ZodOptional<z.ZodString>;
        transactionDate: z.ZodISODateTime;
        notes: z.ZodOptional<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<{
            MANUAL: "MANUAL";
            BANK_SYNC: "BANK_SYNC";
            IMPORT: "IMPORT";
        }>>;
        bankTransactionId: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        accountId: z.ZodString;
        ownerUserId: z.ZodString;
        categoryId: z.ZodString;
        type: z.ZodLiteral<"INCOME">;
    }, z.core.$strip>, z.ZodObject<{
        amountMinor: z.ZodNumber;
        currency: z.ZodString;
        description: z.ZodString;
        merchant: z.ZodOptional<z.ZodString>;
        transactionDate: z.ZodISODateTime;
        notes: z.ZodOptional<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<{
            MANUAL: "MANUAL";
            BANK_SYNC: "BANK_SYNC";
            IMPORT: "IMPORT";
        }>>;
        bankTransactionId: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        type: z.ZodLiteral<"TRANSFER">;
        sourceAccountId: z.ZodString;
        destinationAccountId: z.ZodString;
    }, z.core.$strip>], "type">;
}, z.core.$strip>;
export declare const transactionIdSchema: z.ZodObject<{
    householdId: z.ZodString;
    transactionId: z.ZodString;
}, z.core.$strip>;
export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
//# sourceMappingURL=transaction.d.ts.map