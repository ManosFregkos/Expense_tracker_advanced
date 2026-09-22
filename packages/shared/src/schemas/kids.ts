import { z } from 'zod'
import { idSchema } from './common.js'
import type { StoredDate } from '../domain/types.js'

export const kidsGameTypeSchema = z.enum(['EXPLORER', 'MEMORY', 'LOGIC'])
export type KidsGameType = z.infer<typeof kidsGameTypeSchema>
export const kidsSkillSchema = z.enum([
  'MEMORY',
  'OBSERVATION',
  'LOGIC',
  'VOCABULARY',
  'CLASSIFICATION',
  'COUNTING',
  'CAUSE_EFFECT',
  'SPATIAL',
])
export type KidsSkill = z.infer<typeof kidsSkillSchema>
export const childAgeBandSchema = z.enum(['2_PLUS', '3_PLUS', '4_PLUS', '5_PLUS'])
export const kidsDifficultyModeSchema = z.enum(['AUTO', 'EASY', 'MEDIUM', 'HARD'])
export const childProfileInputSchema = z.object({
  householdId: idSchema,
  childProfileId: idSchema.optional(),
  displayName: z.string().trim().min(1).max(40),
  avatarId: z.enum(['star', 'moon', 'sun', 'flower']).default('star'),
  ageBand: childAgeBandSchema.default('3_PLUS'),
  preferredLanguage: z.literal('el-GR').default('el-GR'),
  defaultDifficultyMode: kidsDifficultyModeSchema.default('AUTO'),
  sessionLength: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
  soundEnabled: z.boolean().default(true),
  narrationEnabled: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
})
export type ChildProfileInput = z.infer<typeof childProfileInputSchema>
export type ChildProfile = ChildProfileInput & {
  id: string
  createdBy: string
  createdAt: StoredDate
  updatedAt: StoredDate
  archivedAt?: StoredDate
}
export interface KidsGameSession {
  id: string
  householdId: string
  childProfileId: string
  gameType: KidsGameType
  worldId?: string
  createdBy: string
  roundCount: number
  completedRoundCount: number
  startedAt: StoredDate
  completedAt?: StoredDate
  createdAt: StoredDate
}
export interface KidsGameAttempt {
  id: string
  householdId: string
  childProfileId: string
  sessionId: string
  roundId: string
  gameType: KidsGameType
  contentId: string
  skill: KidsSkill
  difficulty: number
  isCorrect: boolean
  attemptCount: number
  createdAt: StoredDate
}
export interface KidsGameProgress {
  householdId: string
  childProfileId: string
  gameType: KidsGameType
  currentDifficulty: number
  sessionsPlayed: number
  roundsPlayed: number
  skillExposure: Partial<Record<KidsSkill, number>>
  recentResults: boolean[]
  roundsSinceChange: number
  lastPlayedAt?: StoredDate
  updatedAt: StoredDate
}

const logicOptionSchema = z.object({
  id: idSchema,
  assetId: z.enum([
    'fish',
    'octopus',
    'dolphin',
    'turtle',
    'crab',
    'starfish',
    'shell',
    'seaweed',
    'treasure',
    'elephant',
    'monkey',
    'parrot',
    'tiger',
    'snake',
    'frog',
    'banana',
    'butterfly',
    'tree',
    'earth',
    'moon',
    'sun',
    'rocket',
    'astronaut',
    'stars',
    'planet',
    'satellite',
    'comet',
    'apple',
    'pear',
    'orange',
    'cat',
    'dog',
    'bird',
    'flower',
    'umbrella',
    'cloud',
    'rain',
    'water',
    'ice',
    'cup',
    'pillow',
    'glasses',
    'sleep',
    'ball',
    'book',
    'seed',
    'bread',
    'lamp',
    'hat',
    'shoes',
    'plate',
    'friend',
    'hand',
    'towel',
  ]),
  label: z.string().trim().min(1).max(60),
  isPreferredAnswer: z.boolean(),
  explanationNarration: z.string().trim().max(200).optional(),
  nextNodeId: idSchema.optional(),
})
export const customLogicSchema = z
  .object({
    householdId: idSchema,
    contentId: idSchema.optional(),
    title: z.string().trim().min(1).max(80),
    difficulty: z.number().int().min(1).max(3),
    skill: z.enum(['LOGIC', 'CAUSE_EFFECT', 'CLASSIFICATION']),
    narrationText: z.string().trim().min(1).max(240),
    illustrationAssetId: logicOptionSchema.shape.assetId,
    options: z.array(logicOptionSchema).min(2).max(3),
  })
  .superRefine((value, context) => {
    if (value.options.filter((option) => option.isPreferredAnswer).length !== 1)
      context.addIssue({ code: 'custom', message: 'Select exactly one preferred answer.' })
    if (
      new Set(value.options.map((option) => option.id)).size !== value.options.length ||
      new Set(value.options.map((option) => option.assetId)).size !== value.options.length
    )
      context.addIssue({ code: 'custom', message: 'Options must be unique.' })
  })
export type CustomLogicInput = z.infer<typeof customLogicSchema>

export const startKidsSessionSchema = z.object({
  householdId: idSchema,
  childProfileId: idSchema,
  gameType: kidsGameTypeSchema,
  worldId: z.enum(['underwater', 'jungle', 'space']).optional(),
  sessionId: idSchema,
})
export const completeKidsRoundSchema = z.object({
  householdId: idSchema,
  childProfileId: idSchema,
  sessionId: idSchema,
  roundId: idSchema,
  contentId: idSchema,
  skill: kidsSkillSchema,
  difficulty: z.number().int().min(1).max(4),
  isCorrect: z.boolean(),
  attemptCount: z.number().int().min(1).max(100),
})
export const completeKidsSessionSchema = z.object({
  householdId: idSchema,
  childProfileId: idSchema,
  sessionId: idSchema,
})
export const archiveKidsContentSchema = z.object({ householdId: idSchema, contentId: idSchema })
