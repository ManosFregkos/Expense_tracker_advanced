import { z } from 'zod'

export const idSchema = z.string().trim().min(1).max(128)
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter uppercase currency code')
export const amountMinorSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const signedAmountMinorSchema = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
export const isoDateSchema = z.iso.datetime({ offset: true })
export const shortTextSchema = z.string().trim().min(1).max(160)
export const optionalTextSchema = z.string().trim().max(1000).optional()
export const timeZoneSchema = z.string().trim().min(1).max(100)
