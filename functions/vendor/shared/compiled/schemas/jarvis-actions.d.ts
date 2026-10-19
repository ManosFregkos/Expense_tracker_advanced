import { z } from 'zod';
export declare const jarvisTaskPayloadSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodEnum<{
        NONE: "NONE";
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
        URGENT: "URGENT";
    }>>;
    assigneeUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    listId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reminderOffsetMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    relatedTransactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodLiteral<"TODO">>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
    recurrence: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        frequency: z.ZodEnum<{
            DAILY: "DAILY";
            WEEKLY: "WEEKLY";
            MONTHLY: "MONTHLY";
            YEARLY: "YEARLY";
            CUSTOM: "CUSTOM";
        }>;
        interval: z.ZodNumber;
        daysOfWeek: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        customUnit: z.ZodOptional<z.ZodEnum<{
            DAY: "DAY";
            WEEK: "WEEK";
            MONTH: "MONTH";
            YEAR: "YEAR";
        }>>;
        endType: z.ZodEnum<{
            NEVER: "NEVER";
            UNTIL_DATE: "UNTIL_DATE";
            AFTER_OCCURRENCES: "AFTER_OCCURRENCES";
        }>;
        maxOccurrences: z.ZodOptional<z.ZodNumber>;
        untilDate: z.ZodOptional<z.ZodISODate>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const jarvisActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"CREATE_EXPENSE">;
    payload: z.ZodObject<{
        accountId: z.ZodString;
        categoryId: z.ZodString;
        amountMinor: z.ZodNumber;
        currency: z.ZodString;
        description: z.ZodString;
        transactionDate: z.ZodISODateTime;
        merchant: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"CREATE_TASK">;
    payload: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        priority: z.ZodDefault<z.ZodEnum<{
            NONE: "NONE";
            LOW: "LOW";
            MEDIUM: "MEDIUM";
            HIGH: "HIGH";
            URGENT: "URGENT";
        }>>;
        assigneeUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        listId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        dueTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reminderOffsetMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        sortOrder: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        relatedTransactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodDefault<z.ZodLiteral<"TODO">>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
        recurrence: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            frequency: z.ZodEnum<{
                DAILY: "DAILY";
                WEEKLY: "WEEKLY";
                MONTHLY: "MONTHLY";
                YEARLY: "YEARLY";
                CUSTOM: "CUSTOM";
            }>;
            interval: z.ZodNumber;
            daysOfWeek: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            customUnit: z.ZodOptional<z.ZodEnum<{
                DAY: "DAY";
                WEEK: "WEEK";
                MONTH: "MONTH";
                YEAR: "YEAR";
            }>>;
            endType: z.ZodEnum<{
                NEVER: "NEVER";
                UNTIL_DATE: "UNTIL_DATE";
                AFTER_OCCURRENCES: "AFTER_OCCURRENCES";
            }>;
            maxOccurrences: z.ZodOptional<z.ZodNumber>;
            untilDate: z.ZodOptional<z.ZodISODate>;
        }, z.core.$strict>>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"COMPLETE_TASK">;
    payload: z.ZodObject<{
        taskId: z.ZodString;
        expectedVersion: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"RESCHEDULE_TASK">;
    payload: z.ZodObject<{
        taskId: z.ZodString;
        expectedVersion: z.ZodNumber;
        dueDate: z.ZodISODate;
        dueTime: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>], "type">;
export declare const jarvisPrepareActionSchema: z.ZodObject<{
    householdId: z.ZodString;
    sessionId: z.ZodString;
    idempotencyKey: z.ZodString;
    action: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"CREATE_EXPENSE">;
        payload: z.ZodObject<{
            accountId: z.ZodString;
            categoryId: z.ZodString;
            amountMinor: z.ZodNumber;
            currency: z.ZodString;
            description: z.ZodString;
            transactionDate: z.ZodISODateTime;
            merchant: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"CREATE_TASK">;
        payload: z.ZodObject<{
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            priority: z.ZodDefault<z.ZodEnum<{
                NONE: "NONE";
                LOW: "LOW";
                MEDIUM: "MEDIUM";
                HIGH: "HIGH";
                URGENT: "URGENT";
            }>>;
            assigneeUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            listId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            dueTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reminderOffsetMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            sortOrder: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            relatedTransactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            status: z.ZodDefault<z.ZodLiteral<"TODO">>;
            dueDate: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
            recurrence: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                frequency: z.ZodEnum<{
                    DAILY: "DAILY";
                    WEEKLY: "WEEKLY";
                    MONTHLY: "MONTHLY";
                    YEARLY: "YEARLY";
                    CUSTOM: "CUSTOM";
                }>;
                interval: z.ZodNumber;
                daysOfWeek: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
                customUnit: z.ZodOptional<z.ZodEnum<{
                    DAY: "DAY";
                    WEEK: "WEEK";
                    MONTH: "MONTH";
                    YEAR: "YEAR";
                }>>;
                endType: z.ZodEnum<{
                    NEVER: "NEVER";
                    UNTIL_DATE: "UNTIL_DATE";
                    AFTER_OCCURRENCES: "AFTER_OCCURRENCES";
                }>;
                maxOccurrences: z.ZodOptional<z.ZodNumber>;
                untilDate: z.ZodOptional<z.ZodISODate>;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"COMPLETE_TASK">;
        payload: z.ZodObject<{
            taskId: z.ZodString;
            expectedVersion: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESCHEDULE_TASK">;
        payload: z.ZodObject<{
            taskId: z.ZodString;
            expectedVersion: z.ZodNumber;
            dueDate: z.ZodISODate;
            dueTime: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">;
}, z.core.$strict>;
export declare const jarvisActionReferenceSchema: z.ZodObject<{
    householdId: z.ZodString;
    sessionId: z.ZodString;
    proposalId: z.ZodString;
}, z.core.$strict>;
export type JarvisAction = z.infer<typeof jarvisActionSchema>;
export type JarvisPrepareActionInput = z.infer<typeof jarvisPrepareActionSchema>;
export type JarvisActionReference = z.infer<typeof jarvisActionReferenceSchema>;
export type JarvisActionStatus = 'PENDING' | 'COMMITTED' | 'CANCELLED' | 'EXPIRED';
export interface JarvisActionResult {
    entityId: string;
    nextTaskId?: string | null;
}
export interface JarvisActionProposal {
    proposalId: string;
    householdId: string;
    sessionId: string;
    action: JarvisAction;
    summary: string;
    status: JarvisActionStatus;
    createdAt: string;
    expiresAt: string;
    result: JarvisActionResult | null;
}
//# sourceMappingURL=jarvis-actions.d.ts.map