import type {
  EmotionType,
  KidsCardGameMode,
  KidsCompareRelation,
  KidsComparisonDimension,
  KidsDifficulty,
} from '@family-expense-tracker/shared'
import type { EarlyQuantity, QuantityRepresentation, SimpleSum } from '../early-learning/types'

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

interface NumberRoundCommon extends KidsRoundCommon {
  conceptId: `number:${EarlyQuantity}`
  options: EarlyQuantity[]
  correctQuantity: EarlyQuantity
}

export interface CountFingersRound extends NumberRoundCommon {
  mode: 'COUNT_FINGERS'
  fingerAssetId: string
}

export interface MatchFingersToNumberRound extends NumberRoundCommon {
  mode: 'MATCH_FINGERS_TO_NUMBER'
  direction: 'FINGERS_TO_NUMERAL' | 'NUMERAL_TO_FINGERS'
  target: QuantityRepresentation
}

export interface CountObjectsRound extends NumberRoundCommon {
  mode: 'COUNT_OBJECTS'
  objectAssetId: string
  renderedQuantity: EarlyQuantity
}

export interface MatchQuantityToNumberRound extends NumberRoundCommon {
  mode: 'MATCH_QUANTITY_TO_NUMBER'
  direction: 'QUANTITY_TO_NUMERAL' | 'NUMERAL_TO_QUANTITY'
  objectAssetId: string
}

export interface CompareQuantityRound extends KidsRoundCommon {
  mode: 'COMPARE_QUANTITY'
  relation: 'MORE' | 'LESS' | 'SAME_AMOUNT'
  left: QuantityRepresentation
  right: QuantityRepresentation
  correctSide: 'LEFT' | 'RIGHT' | 'SAME'
  conceptId: 'quantity:more' | 'quantity:less' | 'quantity:same'
}

export interface SimpleSumRound extends Omit<NumberRoundCommon, 'conceptId'> {
  mode: 'SIMPLE_SUM'
  sum: SimpleSum
  stage: 'CONCRETE' | 'VISUAL_NUMERAL' | 'NUMERAL'
  conceptId: 'addition:within-3' | 'addition:within-5'
}

export interface LearnFlagRound extends KidsRoundCommon {
  mode: 'LEARN_FLAG'
  countryId: string
  flagAssetId: string
  conceptId: `flag:${string}`
}

export interface FindFlagRound extends KidsRoundCommon {
  mode: 'FIND_FLAG'
  countryId: string
  optionCountryIds: string[]
  correctCountryId: string
  conceptId: `flag:${string}`
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
  | CountFingersRound
  | MatchFingersToNumberRound
  | CountObjectsRound
  | MatchQuantityToNumberRound
  | CompareQuantityRound
  | SimpleSumRound
  | LearnFlagRound
  | FindFlagRound

export interface RoundGenerationInput {
  deckId: string
  difficulty: KidsDifficulty
  roundIndex: number
  rng: () => number
  preferredCardIds?: string[]
  recentContentIds?: ReadonlySet<string>
  maximumQuantity?: 3 | 5
  maximumSum?: 3 | 5
  flagTier?: 1 | 2 | 3
  newFlagsPerSession?: 2 | 3 | 4
}

export interface RoundGenerator<T extends KidsCardRound = KidsCardRound> {
  generate(input: RoundGenerationInput): T | null
}
