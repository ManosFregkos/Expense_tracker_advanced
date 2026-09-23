import type { KidsCardGameMode, KidsDifficulty } from '@family-expense-tracker/shared'
import { DECKS_BY_ID, getSupportedModes } from '../content/system'
import { shuffled } from './random'

export interface PlannedRound {
  mode: Exclude<KidsCardGameMode, 'MIXED_PLAY'>
  deckId: string
  difficulty: KidsDifficulty
}

const GLOBAL_MODES: PlannedRound[] = [
  { mode: 'EVERYDAY_CHOICE', deckId: 'everyday', difficulty: 1 },
  { mode: 'SEQUENCE', deckId: 'sequences', difficulty: 1 },
  { mode: 'EMOTION', deckId: 'emotions', difficulty: 1 },
]

export class MixedPlayPlanner {
  plan(input: {
    deckId: string
    difficulty: KidsDifficulty
    sessionLength: number
    rng: () => number
    recentModes?: KidsCardGameMode[]
  }): PlannedRound[] {
    const deck = DECKS_BY_ID.get(input.deckId)
    const local = deck
      ? getSupportedModes(deck)
          .filter((mode): mode is Exclude<KidsCardGameMode, 'MIXED_PLAY'> => mode !== 'MIXED_PLAY')
          .map((mode) => ({ mode, deckId: deck.id, difficulty: input.difficulty }))
      : []
    const available = [
      ...local,
      ...GLOBAL_MODES.map((item) => ({ ...item, difficulty: input.difficulty })),
    ]
    if (!available.length) return []
    const result: PlannedRound[] = []
    let pool = shuffled(available, input.rng)
    for (let index = 0; index < input.sessionLength; index += 1) {
      if (!pool.length) pool = shuffled(available, input.rng)
      const lastTwo = result.slice(-2).map((item) => item.mode)
      const selectedIndex = pool.findIndex(
        (item) => !(lastTwo.length === 2 && lastTwo.every((mode) => mode === item.mode)),
      )
      const selected = pool.splice(selectedIndex < 0 ? 0 : selectedIndex, 1)[0]
      if (!selected) break
      result.push(selected)
    }
    return result
  }
}
