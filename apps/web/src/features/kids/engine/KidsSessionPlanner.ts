import type { CardLearningProgress, LearningCard } from '@family-expense-tracker/shared'
import { SPACED_LEARNING_MIX } from '@family-expense-tracker/shared'
import { shuffled } from './random'

export class KidsSessionPlanner {
  selectLearningCards(input: {
    cards: LearningCard[]
    progress: CardLearningProgress[]
    roundCount: number
    recentContentIds?: ReadonlySet<string>
    rng: () => number
  }): string[] {
    const progressById = new Map(input.progress.map((item) => [item.cardId, item]))
    const withoutRecent = input.cards.filter((card) => !input.recentContentIds?.has(card.id))
    const pool = withoutRecent.length >= 2 ? withoutRecent : input.cards
    const buckets = {
      NEW: shuffled(
        pool.filter((card) => (progressById.get(card.id)?.status ?? 'NEW') === 'NEW'),
        input.rng,
      ),
      LEARNING: shuffled(
        pool.filter((card) => progressById.get(card.id)?.status === 'LEARNING'),
        input.rng,
      ),
      FAMILIAR: shuffled(
        pool.filter((card) => progressById.get(card.id)?.status === 'FAMILIAR'),
        input.rng,
      ),
    }
    const requested = {
      LEARNING: Math.round(input.roundCount * SPACED_LEARNING_MIX.LEARNING),
      NEW: Math.round(input.roundCount * SPACED_LEARNING_MIX.NEW),
      FAMILIAR: Math.round(input.roundCount * SPACED_LEARNING_MIX.FAMILIAR),
    }
    const selected: string[] = []
    for (const status of ['LEARNING', 'NEW', 'FAMILIAR'] as const) {
      selected.push(...buckets[status].slice(0, requested[status]).map((card) => card.id))
    }
    const fallback = shuffled(pool, input.rng).map((card) => card.id)
    let index = 0
    while (selected.length < input.roundCount && fallback.length) {
      selected.push(fallback[index % fallback.length]!)
      index += 1
    }
    return shuffled(selected.slice(0, input.roundCount), input.rng)
  }
}
