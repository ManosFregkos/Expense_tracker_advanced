import { z } from 'zod';
export declare const jarvisChatSchema: z.ZodObject<{
    householdId: z.ZodString;
    sessionId: z.ZodUUID;
    requestId: z.ZodUUID;
    message: z.ZodString;
    language: z.ZodDefault<z.ZodEnum<{
        "en-US": "en-US";
        "el-GR": "el-GR";
    }>>;
    defaultAccountId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const jarvisActionSchema: z.ZodObject<{
    householdId: z.ZodString;
    sessionId: z.ZodUUID;
    requestId: z.ZodUUID;
    decision: z.ZodEnum<{
        CONFIRM: "CONFIRM";
        CANCEL: "CANCEL";
    }>;
}, z.core.$strip>;
export type JarvisChatInput = z.infer<typeof jarvisChatSchema>;
export type JarvisActionInput = z.infer<typeof jarvisActionSchema>;
export interface JarvisReply {
    reply: string;
    action: null | {
        requestId: string;
        kind: 'CREATE_TRANSACTION' | 'DELETE_TRANSACTION' | 'CREATE_TASK';
        summary: string;
        expiresAt: string;
    };
}
export interface JarvisActionResult {
    status: 'COMPLETED' | 'CANCELLED';
    message: string;
    entityId?: string;
}
//# sourceMappingURL=jarvis.d.ts.map