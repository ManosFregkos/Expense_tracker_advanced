import type {
  CardLearningProgress,
  KidsCardGameMode,
  KidsDifficulty,
} from '@family-expense-tracker/shared'
import { CompareRoundGenerator } from './generators/CompareRoundGenerator'
import { LearnChooseRoundGenerator } from './generators/LearnChooseRoundGenerator'
import { MatchingRoundGenerator } from './generators/MatchingRoundGenerator'
import { OddOneOutRoundGenerator } from './generators/OddOneOutRoundGenerator'
import { SameDifferentRoundGenerator } from './generators/SameDifferentRoundGenerator'
import { EverydayChoiceRoundGenerator } from './generators/EverydayChoiceRoundGenerator'
import { ClassificationRoundGenerator } from './generators/ClassificationRoundGenerator'
import { SequenceRoundGenerator } from './generators/SequenceRoundGenerator'
import { EmotionRoundGenerator } from './generators/EmotionRoundGenerator'
import { MemoryPairsGenerator } from './generators/MemoryPairsGenerator'
import {
  CompareQuantityRoundGenerator,
  CountFingersRoundGenerator,
  CountObjectsRoundGenerator,
  FindFlagRoundGenerator,
  LearnFlagRoundGenerator,
  MatchFingersToNumberRoundGenerator,
  MatchQuantityToNumberRoundGenerator,
  SimpleSumRoundGenerator,
} from '../early-learning/generators'
import { MixedPlayPlanner } from './MixedPlayPlanner'
import { seededRandom } from './random'
import type { KidsCardRound, RoundGenerator } from './types'
import { KidsSessionPlanner } from './KidsSessionPlanner'
import { cardsForDeck } from './generators/shared'
import { EUROPEAN_COUNTRIES } from '../early-learning/content'

type ConcreteMode = Exclude<KidsCardGameMode, 'MIXED_PLAY'>

const generators: Record<ConcreteMode, RoundGenerator> = {
  LEARN_AND_CHOOSE: new LearnChooseRoundGenerator(),
  SAME_OR_DIFFERENT: new SameDifferentRoundGenerator(),
  MATCHING: new MatchingRoundGenerator(),
  ODD_ONE_OUT: new OddOneOutRoundGenerator(),
  COMPARE: new CompareRoundGenerator(),
  EVERYDAY_CHOICE: new EverydayChoiceRoundGenerator(),
  CLASSIFY: new ClassificationRoundGenerator(),
  SEQUENCE: new SequenceRoundGenerator(),
  EMOTION: new EmotionRoundGenerator(),
  MEMORY_PAIRS: new MemoryPairsGenerator(),
  COUNT_FINGERS: new CountFingersRoundGenerator(),
  MATCH_FINGERS_TO_NUMBER: new MatchFingersToNumberRoundGenerator(),
  COMPARE_QUANTITY: new CompareQuantityRoundGenerator(),
  COUNT_OBJECTS: new CountObjectsRoundGenerator(),
  MATCH_QUANTITY_TO_NUMBER: new MatchQuantityToNumberRoundGenerator(),
  SIMPLE_SUM: new SimpleSumRoundGenerator(),
  LEARN_FLAG: new LearnFlagRoundGenerator(),
  FIND_FLAG: new FindFlagRoundGenerator(),
}

export class KidsRoundGenerator {
  generateSession(input: {
    mode: KidsCardGameMode
    deckId: string
    difficulty: KidsDifficulty
    roundCount: number
    seed?: number
    cardProgress?: CardLearningProgress[]
    recentContentIds?: string[]
    maximumQuantity?: 3 | 5
    maximumSum?: 3 | 5
    flagTier?: 1 | 2 | 3
    newFlagsPerSession?: 2 | 3 | 4
  }): KidsCardRound[] {
    const rng = seededRandom(input.seed ?? Date.now())
    const preferredCardIds = input.mode === 'LEARN_AND_CHOOSE'
      ? new KidsSessionPlanner().selectLearningCards({
            cards: cardsForDeck(input.deckId),
            progress: input.cardProgress ?? [],
            roundCount: input.roundCount,
            recentContentIds: new Set(input.recentContentIds ?? []),
            rng,
          })
      : input.mode === 'LEARN_FLAG' || input.mode === 'FIND_FLAG'
        ? EUROPEAN_COUNTRIES
            .map((country) => ({
              conceptId: `flag:${country.iso2}`,
              progress: input.cardProgress?.find((item) => item.cardId === `flag:${country.iso2}`),
            }))
            .sort((left, right) => {
              const priority = (item: CardLearningProgress | undefined) =>
                item && (item.recentMisses ?? 0) > 0 ? 0 : item?.status === 'LEARNING' ? 1 : !item || item.status === 'NEW' ? 2 : 3
              return priority(left.progress) - priority(right.progress)
            })
            .map((item) => item.conceptId)
        : undefined
    if (input.mode === 'MIXED_PLAY') {
      const plan = new MixedPlayPlanner().plan({
        deckId: input.deckId,
        difficulty: input.difficulty,
        sessionLength: input.roundCount,
        rng,
      })
      return plan.flatMap((item, index) => {
        const round = generators[item.mode].generate({
          deckId: item.deckId,
          difficulty: item.difficulty,
          roundIndex: index,
          rng,
          ...(preferredCardIds ? { preferredCardIds } : {}),
          recentContentIds: new Set(input.recentContentIds ?? []),
          maximumQuantity: input.maximumQuantity,
          maximumSum: input.maximumSum,
          flagTier: input.flagTier,
          newFlagsPerSession: input.newFlagsPerSession,
        })
        return round ? [round] : []
      })
    }
    const rounds: KidsCardRound[] = []
    for (let index = 0; index < input.roundCount; index += 1) {
      const teachingCount = Math.min(input.newFlagsPerSession ?? 3, Math.max(1, input.roundCount - 2))
      const activeMode = input.mode === 'LEARN_FLAG' && index >= teachingCount ? 'FIND_FLAG' : input.mode
      const round = generators[activeMode].generate({
        deckId: input.deckId,
        difficulty: input.difficulty,
        roundIndex: activeMode === 'FIND_FLAG' && input.mode === 'LEARN_FLAG' ? index - teachingCount : index,
        rng,
        ...(preferredCardIds ? { preferredCardIds } : {}),
        recentContentIds: new Set(input.recentContentIds ?? []),
        maximumQuantity: input.maximumQuantity,
        maximumSum: input.maximumSum,
        flagTier: input.flagTier,
        newFlagsPerSession: input.newFlagsPerSession,
      })
      if (!round) break
      rounds.push(round)
    }
    return rounds
  }
}
