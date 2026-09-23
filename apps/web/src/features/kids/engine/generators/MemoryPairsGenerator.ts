import { shuffled } from '../random'
import type { MemoryPairsRound, RoundGenerationInput, RoundGenerator } from '../types'
import { cardsForDeck, roundId } from './shared'

export class MemoryPairsGenerator implements RoundGenerator<MemoryPairsRound> {
  generate(input: RoundGenerationInput): MemoryPairsRound | null {
    const pairCount = (input.difficulty >= 3 ? 4 : input.difficulty === 2 ? 3 : 2) as 2 | 3 | 4
    const concepts = shuffled(cardsForDeck(input.deckId), input.rng).slice(0, pairCount)
    if (
      concepts.length !== pairCount ||
      new Set(concepts.map((card) => card.id)).size !== pairCount
    )
      return null
    const cards = concepts.flatMap((card) =>
      [0, 1].map((copy) => ({
        instanceId: card.id + '-' + copy,
        cardId: card.id,
        pairId: card.id,
      })),
    )
    return {
      id: roundId('memory', input.deckId, input.roundIndex),
      mode: 'MEMORY_PAIRS',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: 'Βρες τα ίδια ζευγάρια!',
      narrationText: 'Βρες τα ίδια ζευγάρια!',
      skill: 'MEMORY',
      contentIds: concepts.map((card) => card.id),
      cards: shuffled(cards, input.rng),
      pairCount,
    }
  }
}
