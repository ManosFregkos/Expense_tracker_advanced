import type { SameDifferentRound, RoundGenerationInput, RoundGenerator } from '../types'
import { sample } from '../random'
import { cardsForDeck, roundId } from './shared'

export class SameDifferentRoundGenerator implements RoundGenerator<SameDifferentRound> {
  generate(input: RoundGenerationInput): SameDifferentRound | null {
    const cards = cardsForDeck(input.deckId)
    if (cards.length < 2) return null
    const detailPair =
      input.difficulty === 4 && input.deckId === 'shapes'
        ? cards.filter((card) => card.id === 'star-shape' || card.id === 'detail-star')
        : []
    const first = detailPair[0] ?? sample(cards, 1, input.rng)[0]
    if (!first) return null
    const same = !detailPair.length && input.roundIndex % 2 === 0
    const second = same
      ? first
      : (detailPair[1] ??
        sample(
          cards.filter((card) => card.id !== first.id),
          1,
          input.rng,
        )[0])
    if (!second) return null
    const dimension = detailPair.length
      ? 'DETAIL'
      : same
        ? 'OBJECT'
        : first.attributes?.color && second.attributes?.color
          ? 'COLOR'
          : first.attributes?.size && second.attributes?.size
            ? 'SIZE'
            : first.attributes?.shape && second.attributes?.shape
              ? 'SHAPE'
              : 'OBJECT'
    return {
      id: roundId('same-different', input.deckId, input.roundIndex),
      mode: 'SAME_OR_DIFFERENT',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: 'Είναι ίδια ή διαφορετικά;',
      narrationText: 'Κοίταξε καλά. Είναι ίδια ή διαφορετικά;',
      skill: `COMPARE_${dimension}`,
      contentIds: [...new Set([first.id, second.id])],
      cardIds: [first.id, second.id],
      comparisonDimension: dimension,
      correctAnswer: same ? 'SAME' : 'DIFFERENT',
    }
  }
}
