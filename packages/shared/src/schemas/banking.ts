import { z } from 'zod'
import {
  amountMinorSchema,
  currencySchema,
  idSchema,
  isoDateSchema,
  shortTextSchema,
} from './common.js'

export const processBankTransactionSchema = z.object({
  householdId: idSchema,
  bankConnectionId: idSchema,
  externalTransactionId: idSchema,
  accountId: idSchema,
  rawDescription: shortTextSchema,
  amountMinor: amountMinorSchema,
  currency: currencySchema,
  bookingDate: isoDateSchema,
  status: z.enum(['PENDING', 'BOOKED']),
})

export const merchantRuleSchema = z.object({
  householdId: idSchema,
  matcherType: z.literal('CONTAINS'),
  pattern: shortTextSchema.transform((value) => value.toUpperCase()),
  categoryId: idSchema,
})

export type ProcessBankTransactionInput = z.infer<typeof processBankTransactionSchema>
