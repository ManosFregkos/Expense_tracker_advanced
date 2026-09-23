import { sample, shuffled } from '../random'
import type { OddOneOutRound, RoundGenerationInput, RoundGenerator } from '../types'
import { SYSTEM_CARDS } from '../../content/system'
import { cardsForDeck, roundId } from './shared'

export class OddOneOutRoundGenerator implements RoundGenerator<OddOneOutRound> {
  generate(input: RoundGenerationInput): OddOneOutRound | null {
    const sameCategory = cardsForDeck(input.deckId)
    const optionCount = input.difficulty >= 3 ? 4 : 3
    if (sameCategory.length < optionCount - 1) return null
    const shared = sample(sameCategory, optionCount - 1, input.rng)
    const category = shared[0]?.category
    if (!category || shared.some((card) => card.category !== category)) return null
    const oddCandidates = SYSTEM_CARDS.filter((card) => card.category !== category)
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
