import { z } from 'zod'
import {
  KIDS_CARD_GAME_MODES,
  KIDS_COMPARE_RELATIONS,
  KIDS_COMPARISON_DIMENSIONS,
  KIDS_RELATIONSHIP_TYPES,
} from '../domain/types.js'
import { idSchema } from './common.js'

const documentIdSchema = idSchema.refine((value) => !value.includes('/'), 'Invalid document ID.')
export const kidsDifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
])

export const learningCardSchema = z.object({
  id: documentIdSchema,
  deckId: documentIdSchema,
  title: z.string().trim().min(1).max(80),
  narration: z.string().trim().min(1).max(240),
  assetId: documentIdSchema,
  category: z.string().trim().min(1).max(60),
  subcategory: z.string().trim().min(1).max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  attributes: z
    .object({
      color: z.string().trim().max(40).optional(),
      size: z.string().trim().max(40).optional(),
      shape: z.string().trim().max(40).optional(),
      habitat: z.string().trim().max(40).optional(),
      location: z.string().trim().max(40).optional(),
      type: z.string().trim().max(40).optional(),
      count: z.number().int().min(0).max(20).optional(),
    })
    .optional(),
  difficulty: kidsDifficultySchema,
  enabled: z.boolean(),
  origin: z.enum(['SYSTEM', 'CUSTOM']),
})

export const learningDeckSchema = z.object({
  id: documentIdSchema,
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  narrationTitle: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1).max(60),
  ageBand: z.string().trim().max(20).optional(),
  supportedModes: z.array(z.enum(KIDS_CARD_GAME_MODES)).min(1),
  cardIds: z.array(documentIdSchema).min(2),
  enabled: z.boolean(),
  origin: z.enum(['SYSTEM', 'CUSTOM']),
})

export const learningRelationshipSchema = z.object({
  id: documentIdSchema,
  sourceCardId: documentIdSchema,
  targetCardId: documentIdSchema,
  type: z.enum(KIDS_RELATIONSHIP_TYPES),
  narration: z.string().trim().max(240).optional(),
})

export const createKidsChildProfileSchema = z.object({
  householdId: documentIdSchema,
  displayName: z.string().trim().min(1).max(40),
  avatar: z.string().trim().min(1).max(20).default('🌟'),
})

export const updateKidsSettingsSchema = z.object({
  householdId: documentIdSchema,
  childProfileId: documentIdSchema,
  narrationEnabled: z.boolean(),
  soundEffectsEnabled: z.boolean(),
  animationsEnabled: z.boolean(),
  sessionLength: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  difficultyMode: z.enum(['AUTO', 'EASY', 'MEDIUM', 'HARD']),
})

export const startKidsSessionSchema = z.object({
  householdId: documentIdSchema,
  sessionId: documentIdSchema,
  childProfileId: documentIdSchema,
  mode: z.enum(KIDS_CARD_GAME_MODES),
  deckIds: z.array(documentIdSchema).min(1).max(12),
  difficulty: kidsDifficultySchema,
  plannedRounds: z.union([z.literal(5), z.literal(10), z.literal(15)]),
})

export const persistKidsAttemptSchema = z.object({
  householdId: documentIdSchema,
  sessionId: documentIdSchema,
  attemptId: documentIdSchema,
  childProfileId: documentIdSchema,
  mode: z.enum(KIDS_CARD_GAME_MODES),
  roundId: documentIdSchema,
  contentId: documentIdSchema,
  deckId: documentIdSchema,
  selectedOptionIds: z.array(documentIdSchema).min(1).max(4),
  isCorrect: z.boolean(),
  attemptCount: z.number().int().min(1).max(20),
  difficulty: kidsDifficultySchema,
})

export const completeKidsSessionSchema = z.object({
  householdId: documentIdSchema,
  sessionId: documentIdSchema,
  childProfileId: documentIdSchema,
  completedRounds: z.number().int().min(0).max(15),
})

export const kidsComparisonDimensionSchema = z.enum(KIDS_COMPARISON_DIMENSIONS)
export const kidsCompareRelationSchema = z.enum(KIDS_COMPARE_RELATIONS)

export type CreateKidsChildProfileInput = z.infer<typeof createKidsChildProfileSchema>
export type UpdateKidsSettingsInput = z.infer<typeof updateKidsSettingsSchema>
export type StartKidsSessionInput = z.infer<typeof startKidsSessionSchema>
export type PersistKidsAttemptInput = z.infer<typeof persistKidsAttemptSchema>
export type CompleteKidsSessionInput = z.infer<typeof completeKidsSessionSchema>
