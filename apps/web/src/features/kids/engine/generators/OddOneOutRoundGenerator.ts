import { sample, shuffled } from '../random'
import type { OddOneOutRound, RoundGenerationInput, RoundGenerator } from '../types'
import { SYSTEM_CARDS } from '../../content/system'
import { cardsForDeck, roundId } from './shared'

export class OddOneOutRoundGenerator implements RoundGenerator<OddOneOutRound> {
  generate(input: RoundGenerationInput): OddOneOutRound | null {
    const deckCards = cardsForDeck(input.deckId)
    const groups = [...new Set(deckCards.map((card) => card.category))]
      .map((category) => ({
        category,
        cards: deckCards.filter((card) => card.category === category),
      }))
      .sort((left, right) => right.cards.length - left.cards.length)
    const preferredCount = input.difficulty >= 3 ? 4 : 3
    const group = groups.find((item) => item.cards.length >= preferredCount - 1)
    const optionCount = group ? preferredCount : 3
    const fallbackGroup = group ?? groups.find((item) => item.cards.length >= 2)
    if (!fallbackGroup) return null
    const shared = sample(fallbackGroup.cards, optionCount - 1, input.rng)
    const category = fallbackGroup.category
    const oddCandidates = [
      ...deckCards.filter((card) => card.category !== category),
      ...SYSTEM_CARDS.filter((card) => card.deckId !== input.deckId && card.category !== category),
    ]
    const odd = sample(oddCandidates, 1, input.rng)[0]
    if (!odd) return null
    return {
      id: roundId('odd', input.deckId, input.roundIndex),
      mode: 'ODD_ONE_OUT',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: 'Ποιο δεν ταιριάζει;',
      narrationText: 'Κοίταξε προσεκτικά. Ποιο δεν ταιριάζει με τα άλλα;',
      skill: 'CATEGORY_RECOGNITION',
      contentIds: [...shared.map((card) => card.id), odd.id],
      optionCardIds: shuffled([...shared.map((card) => card.id), odd.id], input.rng),
      correctCardId: odd.id,
      sharedCategory: category,
      oddReason: `${odd.title} δεν ανήκει στην ομάδα ${category}.`,
    }
  }
}
