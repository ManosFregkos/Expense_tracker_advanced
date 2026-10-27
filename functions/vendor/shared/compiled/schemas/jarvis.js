import { z } from 'zod';
const documentId = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[\w-]+$/);
export const jarvisChatSchema = z.object({
    householdId: documentId,
    sessionId: z.uuid(),
    requestId: z.uuid(),
    message: z.string().trim().min(1).max(2000),
    language: z.enum(['en-US', 'el-GR']).default('en-US'),
    defaultAccountId: documentId.nullable().default(null),
    visibleTransactionIds: z.array(documentId).max(100).optional(),
});
export const jarvisActionSchema = jarvisChatSchema
    .pick({
    householdId: true,
    sessionId: true,
    requestId: true,
})
    .extend({ decision: z.enum(['CONFIRM', 'CANCEL']) });
export const JARVIS_AUDIO_MAX_BYTES = 3 * 1024 * 1024;
export const jarvisTranscribeSchema = z.object({
    householdId: documentId,
    language: z.enum(['en-US', 'el-GR']),
    mimeType: z.enum(['audio/webm', 'audio/mp4', 'audio/wav']),
    audioBase64: z
        .string()
        .min(4)
        .max(4 * Math.ceil(JARVIS_AUDIO_MAX_BYTES / 3))
        .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
