import type {
  EmotionType,
  KidsCardGameMode,
  KidsCompareRelation,
  KidsComparisonDimension,
  KidsDifficulty,
} from '@family-expense-tracker/shared'

export interface KidsRoundCommon {
  id: string
  mode: KidsCardGameMode
  difficulty: KidsDifficulty
  deckId: string
  instructionText: string
  narrationText: string
  skill: string
  contentIds: string[]
}

export interface LearnChooseRound extends KidsRoundCommon {
  mode: 'LEARN_AND_CHOOSE'
  teachingCardIds: string[]
  optionCardIds: string[]
  correctCardId: string
}

export interface SameDifferentRound extends KidsRoundCommon {
  mode: 'SAME_OR_DIFFERENT'
  cardIds: [string, string]
  comparisonDimension: KidsComparisonDimension
  correctAnswer: 'SAME' | 'DIFFERENT'
}

export interface MatchingRound extends KidsRoundCommon {
  mode: 'MATCHING'
  sourceCardId: string
  optionCardIds: string[]
  correctCardId: string
  relationshipId: string
}

export interface OddOneOutRound extends KidsRoundCommon {
  mode: 'ODD_ONE_OUT'
  optionCardIds: string[]
  correctCardId: string
  sharedCategory: string
  oddReason: string
}

export interface CompareRound extends KidsRoundCommon {
  mode: 'COMPARE'
  relation: KidsCompareRelation
  options: { cardId: string; numericValue?: number; relationValue?: string }[]
  correctCardId: string
}

export interface EverydayChoiceRound extends KidsRoundCommon {
  mode: 'EVERYDAY_CHOICE'
  scenarioId: string
  situationAssetId?: string
  options: Array<{ id: string; assetId: string; narration: string }>
  correctChoiceId: string
  explanationNarration: string
}

export interface ClassificationRound extends KidsRoundCommon {
  mode: 'CLASSIFY'
  sourceCardId: string
  destinationIds: string[]
  correctDestinationId: string
  relationshipId: string
  explanationNarration: string
}

export interface SequenceRound extends KidsRoundCommon {
  mode: 'SEQUENCE'
  sequenceId: string
  slots: Array<{ stepId: string; assetId?: string; narration?: string; missing: boolean }>
  optionSteps: Array<{ id: string; assetId: string; narration: string }>
  correctStepId: string
  missingIndex: number
  explanationNarration?: string
}

export interface EmotionRound extends KidsRoundCommon {
  mode: 'EMOTION'
  scenarioId: string
  sceneAssetId: string
  options: EmotionType[]
  expectedEmotion: EmotionType
  explanationNarration?: string
}

export interface MemoryPairsRound extends KidsRoundCommon {
  mode: 'MEMORY_PAIRS'
  cards: Array<{ instanceId: string; cardId: string; pairId: string }>
  pairCount: 2 | 3 | 4
}

export type KidsCardRound =
  | LearnChooseRound
  | SameDifferentRound
  | MatchingRound
  | OddOneOutRound
  | CompareRound
  | EverydayChoiceRound
  | ClassificationRound
  | SequenceRound
  | EmotionRound
  | MemoryPairsRound

export interface RoundGenerationInput {
  deckId: string
  difficulty: KidsDifficulty
  roundIndex: number
  rng: () => number
  preferredCardIds?: string[]
  recentContentIds?: ReadonlySet<string>
}

export interface RoundGenerator<T extends KidsCardRound = KidsCardRound> {
  generate(input: RoundGenerationInput): T | null
}
