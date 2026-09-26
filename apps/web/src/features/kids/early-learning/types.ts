import { z } from 'zod'

export const EARLY_QUANTITIES = [1, 2, 3, 4, 5] as const
export type EarlyQuantity = (typeof EARLY_QUANTITIES)[number]
export type QuantityRepresentationType = 'NUMERAL' | 'FINGERS' | 'OBJECTS'

export interface FingerQuantityAsset {
  id: string
  quantity: EarlyQuantity
  assetId: string
  narration: string
}

export interface QuantityRepresentation {
  quantity: EarlyQuantity
  type: QuantityRepresentationType
  assetId?: string
  objectAssetId?: string
}

export interface SimpleSum {
  left: EarlyQuantity
  right: EarlyQuantity
  result: EarlyQuantity
  representation: 'FINGERS' | 'OBJECTS' | 'FINGERS_AND_NUMERALS'
}

export interface EuropeanCountry {
  id: string
  iso2: string
  nameEl: string
  nameEn: string
  genitiveEl: string
  flagAssetId: string
  difficultyTier: 1 | 2 | 3
  similarFlagCountryIds?: string[]
  enabled: boolean
}

export const earlyQuantitySchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
])

export const fingerQuantitySchema = z.object({
  id: z.string().min(1), quantity: earlyQuantitySchema, assetId: z.string().min(1), narration: z.string().min(1),
})

export const quantityRepresentationSchema = z.object({
  quantity: earlyQuantitySchema,
  type: z.enum(['NUMERAL', 'FINGERS', 'OBJECTS']),
  assetId: z.string().optional(),
  objectAssetId: z.string().optional(),
})

export const simpleSumSchema = z.object({
  left: earlyQuantitySchema,
  right: earlyQuantitySchema,
  result: earlyQuantitySchema,
  representation: z.enum(['FINGERS', 'OBJECTS', 'FINGERS_AND_NUMERALS']),
}).refine((sum) => sum.left + sum.right === sum.result, 'Το άθροισμα δεν είναι έγκυρο.')

export const europeanCountrySchema = z.object({
  id: z.string().min(1), iso2: z.string().regex(/^[A-Z]{2}$/), nameEl: z.string().min(1),
  nameEn: z.string().min(1), genitiveEl: z.string().min(1), flagAssetId: z.string().min(1),
  difficultyTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  similarFlagCountryIds: z.array(z.string()).optional(), enabled: z.boolean(),
})

export function asEarlyQuantity(value: number): EarlyQuantity {
  const parsed = earlyQuantitySchema.safeParse(value)
  if (!parsed.success) throw new Error(`Quantity ${value} is outside the supported 1-5 range.`)
  return parsed.data
}
