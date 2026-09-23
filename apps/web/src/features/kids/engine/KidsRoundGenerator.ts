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
import { MixedPlayPlanner } from './MixedPlayPlanner'
import { seededRandom } from './random'
import type { KidsCardRound, RoundGenerator } from './types'
import { KidsSessionPlanner } from './KidsSessionPlanner'
import { cardsForDeck } from './generators/shared'

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
  }): KidsCardRound[] {
    const rng = seededRandom(input.seed ?? Date.now())
    const preferredCardIds =
      input.mode === 'LEARN_AND_CHOOSE'
        ? new KidsSessionPlanner().selectLearningCards({
            cards: cardsForDeck(input.deckId),
            progress: input.cardProgress ?? [],
            roundCount: input.roundCount,
            recentContentIds: new Set(input.recentContentIds ?? []),
            rng,
          })
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
        })
        return round ? [round] : []
      })
    }
    const rounds: KidsCardRound[] = []
    for (let index = 0; index < input.roundCount; index += 1) {
      const round = generators[input.mode].generate({
        deckId: input.deckId,
        difficulty: input.difficulty,
        roundIndex: index,
        rng,
        ...(preferredCardIds ? { preferredCardIds } : {}),
      })
      if (!round) break
      rounds.push(round)
    }
    return rounds
  }
}
