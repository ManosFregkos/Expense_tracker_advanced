import type { KidsCardGameMode, KidsDifficulty } from '@family-expense-tracker/shared'
import { CompareRoundGenerator } from './generators/CompareRoundGenerator'
import { LearnChooseRoundGenerator } from './generators/LearnChooseRoundGenerator'
import { MatchingRoundGenerator } from './generators/MatchingRoundGenerator'
import { OddOneOutRoundGenerator } from './generators/OddOneOutRoundGenerator'
import { SameDifferentRoundGenerator } from './generators/SameDifferentRoundGenerator'
import { seededRandom } from './random'
import type { KidsCardRound, RoundGenerator } from './types'

const generators: Record<KidsCardGameMode, RoundGenerator> = {
  LEARN_AND_CHOOSE: new LearnChooseRoundGenerator(),
  SAME_OR_DIFFERENT: new SameDifferentRoundGenerator(),
  MATCHING: new MatchingRoundGenerator(),
  ODD_ONE_OUT: new OddOneOutRoundGenerator(),
  COMPARE: new CompareRoundGenerator(),
}

export class KidsRoundGenerator {
  generateSession(input: {
    mode: KidsCardGameMode
    deckId: string
    difficulty: KidsDifficulty
    roundCount: number
    seed?: number
  }): KidsCardRound[] {
    const rng = seededRandom(input.seed ?? Date.now())
    const rounds: KidsCardRound[] = []
    for (let index = 0; index < input.roundCount; index += 1) {
      const round = generators[input.mode].generate({
        deckId: input.deckId,
        difficulty: input.difficulty,
        roundIndex: index,
        rng,
      })
      if (!round) break
      rounds.push(round)
    }
    return rounds
  }
}
