import type {
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

export type KidsCardRound =
  LearnChooseRound | SameDifferentRound | MatchingRound | OddOneOutRound | CompareRound

export interface RoundGenerationInput {
  deckId: string
  difficulty: KidsDifficulty
  roundIndex: number
  rng: () => number
}

export interface RoundGenerator<T extends KidsCardRound = KidsCardRound> {
  generate(input: RoundGenerationInput): T | null
}
