import { z } from 'zod';
export declare const createHouseholdSchema: z.ZodObject<{
    name: z.ZodString;
    defaultCurrency: z.ZodDefault<z.ZodString>;
    timeZone: z.ZodDefault<z.ZodString>;
    displayName: z.ZodString;
}, z.core.$strip>;
export declare const createInvitationSchema: z.ZodObject<{
    householdId: z.ZodString;
    email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
    role: z.ZodDefault<z.ZodEnum<{
        ADMIN: "ADMIN";
        MEMBER: "MEMBER";
    }>>;
}, z.core.$strip>;
export declare const invitationIdSchema: z.ZodObject<{
    invitationId: z.ZodString;
}, z.core.$strip>;
export declare const householdIdSchema: z.ZodObject<{
    householdId: z.ZodString;
}, z.core.$strip>;
export declare const updateHouseholdSchema: z.ZodObject<{
    householdId: z.ZodString;
    name: z.ZodString;
    defaultCurrency: z.ZodString;
    timeZone: z.ZodString;
}, z.core.$strip>;
export declare const deleteHouseholdSchema: z.ZodObject<{
    householdId: z.ZodString;
    confirmationName: z.ZodString;
}, z.core.$strip>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
//# sourceMappingURL=household.d.ts.map