import { z } from 'zod';
import { HOUSEHOLD_ROLES } from '../domain/types.js';
import { currencySchema, idSchema, timeZoneSchema } from './common.js';
export const createHouseholdSchema = z.object({
    name: z.string().trim().min(2).max(80),
    defaultCurrency: currencySchema.default('EUR'),
    timeZone: timeZoneSchema.default('Europe/Athens'),
    displayName: z.string().trim().min(1).max(100),
});
export const createInvitationSchema = z.object({
    householdId: idSchema,
    email: z
        .email()
        .max(254)
        .transform((value) => value.toLowerCase()),
    role: z.enum(HOUSEHOLD_ROLES).exclude(['OWNER']).default('MEMBER'),
});
export const invitationIdSchema = z.object({ invitationId: idSchema });
export const householdIdSchema = z.object({ householdId: idSchema });
export const updateHouseholdSchema = z.object({
    householdId: idSchema,
    name: z.string().trim().min(2).max(80),
    defaultCurrency: currencySchema,
    timeZone: timeZoneSchema,
});
export const deleteHouseholdSchema = z.object({
    householdId: idSchema,
    confirmationName: z.string().trim().min(2).max(80),
});
