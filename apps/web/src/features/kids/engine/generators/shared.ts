import type { LearningCard } from '@family-expense-tracker/shared'
import { CARDS_BY_ID, DECKS_BY_ID, SYSTEM_CARDS } from '../../content/system'
import { sample } from '../random'

export function cardsForDeck(deckId: string): LearningCard[] {
  const deck = DECKS_BY_ID.get(deckId)
  if (!deck?.enabled) return []
  return deck.cardIds
    .map((id) => CARDS_BY_ID.get(id))
    .filter((card): card is LearningCard => Boolean(card?.enabled))
}

export function uniqueCards(items: readonly LearningCard[]): LearningCard[] {
  return [...new Map(items.map((card) => [card.id, card])).values()]
}

export function distractorsFor(
  excludedIds: ReadonlySet<string>,
  count: number,
  rng: () => number,
  preferredDeckId?: string,
): LearningCard[] {
  const candidates = SYSTEM_CARDS.filter((card) => card.enabled && !excludedIds.has(card.id)).sort(
    (left, right) =>
      Number(right.deckId === preferredDeckId) - Number(left.deckId === preferredDeckId),
  )
  return sample(uniqueCards(candidates), count, rng)
}

export function roundId(mode: string, deckId: string, index: number): string {
  return `${mode.toLowerCase()}-${deckId}-${index}`
}
