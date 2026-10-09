import { z } from 'zod';
import type { TaskCoreInput } from './task.js';
export declare const jarvisMessageSchema: z.ZodObject<{
    role: z.ZodEnum<{
        user: "user";
        assistant: "assistant";
    }>;
    content: z.ZodString;
}, z.core.$strip>;
export declare const jarvisChatSchema: z.ZodObject<{
    householdId: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>;
    webSearch: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const jarvisExpenseDraftSchema: z.ZodObject<{
    amount: z.ZodString;
    currency: z.ZodString;
    description: z.ZodString;
    date: z.ZodISODate;
    accountId: z.ZodNullable<z.ZodString>;
    categoryId: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export declare const jarvisAudioSchema: z.ZodObject<{
    householdId: z.ZodString;
    audio: z.ZodString;
    mimeType: z.ZodEnum<{
        "audio/webm": "audio/webm";
        "audio/mp4": "audio/mp4";
        "audio/ogg": "audio/ogg";
        "audio/wav": "audio/wav";
    }>;
}, z.core.$strip>;
export declare const jarvisSpeechSchema: z.ZodObject<{
    householdId: z.ZodString;
    text: z.ZodString;
}, z.core.$strip>;
export declare const jarvisRealtimeSchema: z.ZodObject<{
    householdId: z.ZodString;
    sdp: z.ZodString;
    language: z.ZodEnum<{
        "en-US": "en-US";
        "el-GR": "el-GR";
    }>;
    webSearch: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type JarvisMessage = z.infer<typeof jarvisMessageSchema>;
export type JarvisChatInput = z.infer<typeof jarvisChatSchema>;
export type JarvisExpenseDraft = z.infer<typeof jarvisExpenseDraftSchema>;
export type JarvisAudioInput = z.infer<typeof jarvisAudioSchema>;
export type JarvisSpeechInput = z.infer<typeof jarvisSpeechSchema>;
export type JarvisRealtimeInput = z.infer<typeof jarvisRealtimeSchema>;
export interface JarvisRealtimeSession {
    sdp: string;
    model: string;
}
export interface JarvisReply {
    reply: string;
    draft: JarvisExpenseDraft | null;
    sources: Array<{
        title: string;
        url: string;
    }>;
    taskAction?: JarvisTaskAction | null;
}
export type JarvisTaskAction = {
    kind: 'create';
    clientRequestId: string;
    task: TaskCoreInput;
    assigneeName: string | null;
    listName: string | null;
} | {
    kind: 'complete';
    taskId: string;
    title: string;
    expectedVersion: number;
    recurring: boolean;
} | {
    kind: 'reschedule';
    taskId: string;
    expectedVersion: number;
    task: TaskCoreInput;
    previousDueDate: string | null;
    previousDueTime: string | null;
};
//# sourceMappingURL=jarvis.d.ts.map