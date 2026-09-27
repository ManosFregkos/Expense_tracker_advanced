import { z } from 'zod'
import {
  KIDS_CARD_GAME_MODES,
  KIDS_COMPARE_RELATIONS,
  KIDS_COMPARISON_DIMENSIONS,
  KIDS_RELATIONSHIP_TYPES,
  EMOTION_TYPES,
  EVERYDAY_TOPICS,
  PATTERN_SEMANTIC_TYPES,
  PATTERN_TYPES,
  SPATIAL_CONCEPTS,
  WEATHER_TOPICS,
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
  contentVersion: z.number().int().positive().optional(),
  householdId: documentIdSchema.optional(),
  createdBy: documentIdSchema.optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  archivedAt: z.unknown().optional(),
  alternativeNarration: z.string().trim().max(240).optional(),
  assetUrl: z.string().url().max(2048).optional(),
})

export const learningDeckSchema = z.object({
  id: documentIdSchema,
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  narrationTitle: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1).max(60),
  ageBand: z.string().trim().max(20).optional(),
  supportedModes: z.array(z.enum(KIDS_CARD_GAME_MODES)).min(1),
  cardIds: z.array(documentIdSchema),
  enabled: z.boolean(),
  origin: z.enum(['SYSTEM', 'CUSTOM']),
  contentVersion: z.number().int().positive().optional(),
  householdId: documentIdSchema.optional(),
  createdBy: documentIdSchema.optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  archivedAt: z.unknown().optional(),
  icon: z.string().trim().max(12).optional(),
})

export const learningRelationshipSchema = z.object({
  id: documentIdSchema,
  sourceCardId: documentIdSchema,
  targetCardId: documentIdSchema,
  type: z.enum(KIDS_RELATIONSHIP_TYPES),
  narration: z.string().trim().max(240).optional(),
  householdId: documentIdSchema.optional(),
  createdBy: documentIdSchema.optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  enabled: z.boolean().optional(),
  origin: z.enum(['SYSTEM', 'CUSTOM']).optional(),
  archivedAt: z.unknown().optional(),
}).refine((value) => value.sourceCardId !== value.targetCardId, {
  path: ['targetCardId'],
  message: 'Relationship target must differ from its source.',
})

export const everydayScenarioSchema = z
  .object({
    id: documentIdSchema,
    topic: z.enum(EVERYDAY_TOPICS),
    subtopic: z.enum(WEATHER_TOPICS).optional(),
    narration: z.string().trim().min(1).max(240),
    situationAssetId: documentIdSchema.optional(),
    choices: z
      .array(
        z.object({
          id: documentIdSchema,
          assetId: documentIdSchema,
          narration: z.string().trim().min(1).max(160),
        }),
      )
      .min(2)
      .max(3),
    preferredChoiceId: documentIdSchema,
    explanationNarration: z.string().trim().min(1).max(240),
    difficulty: kidsDifficultySchema,
    enabled: z.boolean(),
    origin: z.enum(['SYSTEM', 'CUSTOM']),
    householdId: documentIdSchema.optional(),
    createdBy: documentIdSchema.optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
  })
  .superRefine((value, context) => {
    if (value.topic === 'WEATHER' && !value.subtopic)
      context.addIssue({
        code: 'custom',
        path: ['subtopic'],
        message: 'Weather scenarios require a subtopic.',
      })
    const ids = value.choices.map((choice) => choice.id)
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: 'custom', path: ['choices'], message: 'Choice IDs must be unique.' })
    if (ids.filter((id) => id === value.preferredChoiceId).length !== 1)
      context.addIssue({
        code: 'custom',
        path: ['preferredChoiceId'],
        message: 'Preferred choice must appear exactly once.',
      })
  })

export const patternElementSchema = z.object({
  id: documentIdSchema,
  assetId: documentIdSchema,
  narration: z.string().trim().min(1).max(120).optional(),
  semanticType: z.enum(PATTERN_SEMANTIC_TYPES),
  value: z.string().trim().min(1).max(60),
})

export const patternDefinitionSchema = z
  .object({
    id: documentIdSchema,
    type: z.enum(PATTERN_TYPES),
    elements: z.array(patternElementSchema).min(4).max(6),
    missingIndex: z.number().int().min(0).max(5),
    correctElement: patternElementSchema,
    distractorElements: z.array(patternElementSchema).min(1).max(3),
    narration: z.string().trim().min(1).max(240),
    explanationNarration: z.string().trim().min(1).max(240),
    difficulty: kidsDifficultySchema,
    category: z.enum(PATTERN_SEMANTIC_TYPES),
    enabled: z.boolean(),
    origin: z.enum(['SYSTEM', 'CUSTOM']),
    householdId: documentIdSchema.optional(),
    createdBy: documentIdSchema.optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
  })
  .superRefine((value, context) => {
    if (value.missingIndex >= value.elements.length)
      context.addIssue({ code: 'custom', path: ['missingIndex'], message: 'Missing index is outside the pattern.' })
    if (value.elements[value.missingIndex]?.id !== value.correctElement.id)
      context.addIssue({ code: 'custom', path: ['correctElement'], message: 'Correct element must occupy the missing slot.' })
    const answerIds = [value.correctElement.id, ...value.distractorElements.map((item) => item.id)]
    if (new Set(answerIds).size !== answerIds.length)
      context.addIssue({ code: 'custom', path: ['distractorElements'], message: 'Pattern answers must be unique.' })
    if (value.elements.some((item) => item.semanticType !== value.category))
      context.addIssue({ code: 'custom', path: ['elements'], message: 'Pattern elements must match the category.' })
  })

export const spatialChoiceSchema = z.object({
  id: documentIdSchema,
  assetId: documentIdSchema,
  narration: z.string().trim().min(1).max(160).optional(),
})

export const spatialScenarioSchema = z
  .object({
    id: documentIdSchema,
    concept: z.enum(SPATIAL_CONCEPTS),
    narration: z.string().trim().min(1).max(240),
    promptStyle: z.enum(['FIND_CORRECT_SCENE', 'FIND_CORRECT_OBJECT']),
    choices: z.array(spatialChoiceSchema).min(2).max(3),
    correctChoiceId: documentIdSchema,
    explanationNarration: z.string().trim().min(1).max(240),
    difficulty: kidsDifficultySchema,
    enabled: z.boolean(),
    origin: z.enum(['SYSTEM', 'CUSTOM']),
    householdId: documentIdSchema.optional(),
    createdBy: documentIdSchema.optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
  })
  .superRefine((value, context) => {
    const ids = value.choices.map((choice) => choice.id)
    const assetIds = value.choices.map((choice) => choice.assetId)
    if (new Set(ids).size !== ids.length || new Set(assetIds).size !== assetIds.length)
      context.addIssue({ code: 'custom', path: ['choices'], message: 'Spatial choices must be unique.' })
    if (ids.filter((id) => id === value.correctChoiceId).length !== 1)
      context.addIssue({ code: 'custom', path: ['correctChoiceId'], message: 'Correct choice must appear exactly once.' })
  })

const kidsRoundCommonSchema = z.object({
  id: documentIdSchema,
  difficulty: kidsDifficultySchema,
  deckId: documentIdSchema,
  instructionText: z.string().trim().min(1).max(240),
  narrationText: z.string().trim().min(1).max(240),
  skill: z.string().trim().min(1).max(80),
  contentIds: z.array(documentIdSchema).min(1),
})

export const patternCompleteRoundSchema = kidsRoundCommonSchema
  .extend({
    mode: z.literal('PATTERN_COMPLETE'),
    patternId: documentIdSchema,
    patternType: z.enum(PATTERN_TYPES),
    slots: z.array(patternElementSchema.extend({ missing: z.boolean() })).min(4).max(6),
    options: z.array(patternElementSchema).min(2).max(3),
    correctElementId: documentIdSchema,
    explanationNarration: z.string().trim().min(1).max(240),
    conceptId: z.string().regex(/^pattern:[a-z0-9-]+$/),
    conceptType: z.literal('PATTERN'),
  })
  .superRefine((value, context) => {
    if (value.slots.filter((slot) => slot.missing).length !== 1)
      context.addIssue({ code: 'custom', path: ['slots'], message: 'Exactly one pattern slot must be missing.' })
    const ids = value.options.map((option) => option.id)
    if (new Set(ids).size !== ids.length || ids.filter((id) => id === value.correctElementId).length !== 1)
      context.addIssue({ code: 'custom', path: ['options'], message: 'Pattern round must have one unique correct answer.' })
  })

export const spatialConceptRoundSchema = kidsRoundCommonSchema
  .extend({
    mode: z.literal('SPATIAL_CONCEPT'),
    scenarioId: documentIdSchema,
    concept: z.enum(SPATIAL_CONCEPTS),
    promptStyle: z.enum(['FIND_CORRECT_SCENE', 'FIND_CORRECT_OBJECT']),
    options: z.array(spatialChoiceSchema).min(2).max(3),
    correctChoiceId: documentIdSchema,
    explanationNarration: z.string().trim().min(1).max(240),
    conceptId: z.string().regex(/^spatial:[a-z0-9-]+$/),
    conceptType: z.literal('SPATIAL'),
  })
  .superRefine((value, context) => {
    const ids = value.options.map((option) => option.id)
    const assets = value.options.map((option) => option.assetId)
    if (
      new Set(ids).size !== ids.length ||
      new Set(assets).size !== assets.length ||
      ids.filter((id) => id === value.correctChoiceId).length !== 1
    )
      context.addIssue({ code: 'custom', path: ['options'], message: 'Spatial round must have one unique correct scene.' })
  })

export const sequenceDefinitionSchema = z
  .object({
    id: documentIdSchema,
    title: z.string().trim().max(80).optional(),
    steps: z
      .array(
        z.object({
          id: documentIdSchema,
          assetId: documentIdSchema,
          narration: z.string().trim().min(1).max(160),
        }),
      )
      .min(3)
      .max(5),
    narration: z.string().trim().min(1).max(240),
    explanationNarration: z.string().trim().max(240).optional(),
    difficulty: kidsDifficultySchema,
    category: z.string().trim().min(1).max(60),
    enabled: z.boolean(),
    origin: z.enum(['SYSTEM', 'CUSTOM']),
    householdId: documentIdSchema.optional(),
    createdBy: documentIdSchema.optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
  })
  .superRefine((value, context) => {
    const ids = value.steps.map((step) => step.id)
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'Sequence steps must be unique.',
      })
    const assetIds = value.steps.map((step) => step.assetId)
    if (new Set(assetIds).size !== assetIds.length)
      context.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'Sequence step images must be unique.',
      })
  })

export const emotionScenarioSchema = z
  .object({
    id: documentIdSchema,
    sceneAssetId: documentIdSchema,
    narration: z.string().trim().min(1).max(240),
    options: z.array(z.enum(EMOTION_TYPES)).min(2).max(3),
    expectedEmotion: z.enum(EMOTION_TYPES),
    explanationNarration: z.string().trim().max(240).optional(),
    difficulty: kidsDifficultySchema,
    enabled: z.boolean(),
    origin: z.enum(['SYSTEM', 'CUSTOM']),
    householdId: documentIdSchema.optional(),
    createdBy: documentIdSchema.optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
  })
  .superRefine((value, context) => {
    if (new Set(value.options).size !== value.options.length)
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Emotion options must be unique.',
      })
    if (value.options.filter((option) => option === value.expectedEmotion).length !== 1)
      context.addIssue({
        code: 'custom',
        path: ['expectedEmotion'],
        message: 'Expected emotion must appear exactly once.',
      })
  })

export const kidsAssetMetadataSchema = z.object({
  id: documentIdSchema,
  householdId: documentIdSchema,
  storagePath: z.string().min(1).max(500),
  downloadUrl: z.string().url().max(2048),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  width: z.number().int().positive().max(8192).optional(),
  height: z.number().int().positive().max(8192).optional(),
  createdBy: documentIdSchema,
  createdAt: z.unknown(),
})

export const kidsCustomContentKindSchema = z.enum([
  'DECK',
  'CARD',
  'RELATIONSHIP',
  'EVERYDAY_SCENARIO',
  'SEQUENCE',
  'EMOTION_SCENARIO',
  'PATTERN',
  'SPATIAL_SCENARIO',
])

export const saveKidsCustomContentSchema = z.object({
  householdId: documentIdSchema,
  kind: kidsCustomContentKindSchema,
  content: z.record(z.string(), z.unknown()),
})

export const archiveKidsCustomContentSchema = z.object({
  householdId: documentIdSchema,
  kind: kidsCustomContentKindSchema,
  contentId: documentIdSchema,
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
  earlyMath: z
    .object({
      numberRange: z.enum(['ONE_TO_THREE', 'ONE_TO_FIVE']),
      addition: z.enum(['OFF', 'WITHIN_THREE', 'WITHIN_FIVE']),
      showNumerals: z.enum(['ON', 'OFF', 'AUTO']),
      fingersEnabled: z.boolean(),
      countObjectsEnabled: z.boolean(),
    })
    .optional(),
  flags: z
    .object({
      enabled: z.boolean(),
      tier: z.enum(['AUTO', 'STARTER', 'EXPANDED']),
      newPerSession: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    })
    .optional(),
  contentAreas: z
    .object({
      patterns: z.boolean(),
      spatial: z.boolean(),
      weather: z.boolean(),
      professions: z.boolean(),
    })
    .optional(),
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
  conceptType: z.enum(['NUMBER', 'FLAG', 'COUNTING', 'ADDITION', 'QUANTITY', 'PATTERN', 'SPATIAL', 'WEATHER', 'PROFESSION']).optional(),
  conceptId: z.string().trim().min(1).max(80).optional(),
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
export type SaveKidsCustomContentInput = z.infer<typeof saveKidsCustomContentSchema>
export type ArchiveKidsCustomContentInput = z.infer<typeof archiveKidsCustomContentSchema>
