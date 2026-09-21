import { z } from 'zod';
export declare const taskRecurrenceInputSchema: z.ZodObject<{
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
    untilDate: z.ZodOptional<z.ZodString>;
    maxOccurrences: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const taskCoreInputSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        CANCELLED: "CANCELLED";
        TODO: "TODO";
        IN_PROGRESS: "IN_PROGRESS";
        DONE: "DONE";
    }>>;
    priority: z.ZodDefault<z.ZodEnum<{
        NONE: "NONE";
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
        URGENT: "URGENT";
    }>>;
    assigneeUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    listId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reminderOffsetMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
        untilDate: z.ZodOptional<z.ZodString>;
        maxOccurrences: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    relatedTransactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const createTaskSchema: z.ZodIntersection<z.ZodObject<{
    householdId: z.ZodString;
    clientRequestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        CANCELLED: "CANCELLED";
        TODO: "TODO";
        IN_PROGRESS: "IN_PROGRESS";
        DONE: "DONE";
    }>>;
    priority: z.ZodDefault<z.ZodEnum<{
        NONE: "NONE";
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
        URGENT: "URGENT";
    }>>;
    assigneeUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    listId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reminderOffsetMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
        untilDate: z.ZodOptional<z.ZodString>;
        maxOccurrences: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    relatedTransactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>>;
export declare const updateTaskSchema: z.ZodObject<{
    householdId: z.ZodString;
    taskId: z.ZodString;
    expectedVersion: z.ZodNumber;
    task: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<{
            CANCELLED: "CANCELLED";
            TODO: "TODO";
            IN_PROGRESS: "IN_PROGRESS";
            DONE: "DONE";
        }>>;
        priority: z.ZodDefault<z.ZodEnum<{
            NONE: "NONE";
            LOW: "LOW";
            MEDIUM: "MEDIUM";
            HIGH: "HIGH";
            URGENT: "URGENT";
        }>>;
        assigneeUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        listId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        dueTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reminderOffsetMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
            untilDate: z.ZodOptional<z.ZodString>;
            maxOccurrences: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        sortOrder: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        relatedTransactionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const taskIdSchema: z.ZodObject<{
    householdId: z.ZodString;
    taskId: z.ZodString;
}, z.core.$strip>;
export declare const createTaskListSchema: z.ZodObject<{
    householdId: z.ZodString;
    name: z.ZodString;
    icon: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateTaskListSchema: z.ZodObject<{
    householdId: z.ZodString;
    name: z.ZodString;
    icon: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    taskListId: z.ZodString;
}, z.core.$strip>;
export declare const taskListIdSchema: z.ZodObject<{
    householdId: z.ZodString;
    taskListId: z.ZodString;
}, z.core.$strip>;
export declare const createSubtaskSchema: z.ZodObject<{
    householdId: z.ZodString;
    taskId: z.ZodString;
    title: z.ZodString;
}, z.core.$strip>;
export declare const updateSubtaskSchema: z.ZodObject<{
    householdId: z.ZodString;
    taskId: z.ZodString;
    subtaskId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    isCompleted: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const deleteSubtaskSchema: z.ZodObject<{
    householdId: z.ZodString;
    taskId: z.ZodString;
    subtaskId: z.ZodString;
}, z.core.$strip>;
export declare const reorderTasksSchema: z.ZodObject<{
    householdId: z.ZodString;
    tasks: z.ZodArray<z.ZodObject<{
        taskId: z.ZodString;
        sortOrder: z.ZodNumber;
        expectedVersion: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const registerDeviceTokenSchema: z.ZodObject<{
    householdId: z.ZodString;
    token: z.ZodString;
    platform: z.ZodString;
}, z.core.$strip>;
export declare const notificationSettingsSchema: z.ZodObject<{
    householdId: z.ZodString;
    dueReminders: z.ZodBoolean;
    assignmentNotifications: z.ZodBoolean;
    overdueReminders: z.ZodBoolean;
    emailReminders: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const taskNotificationIdSchema: z.ZodObject<{
    notificationId: z.ZodString;
}, z.core.$strip>;
export type TaskCoreInput = z.infer<typeof taskCoreInputSchema>;
export type TaskCoreFormInput = z.input<typeof taskCoreInputSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTaskListInput = z.infer<typeof createTaskListSchema>;
export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;
//# sourceMappingURL=task.d.ts.map