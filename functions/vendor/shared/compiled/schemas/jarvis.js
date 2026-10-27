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
});
export const jarvisActionSchema = jarvisChatSchema
    .pick({
    householdId: true,
    sessionId: true,
    requestId: true,
})
    .extend({ decision: z.enum(['CONFIRM', 'CANCEL']) });
