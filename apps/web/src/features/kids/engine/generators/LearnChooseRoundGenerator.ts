import { CARDS_BY_ID } from '../../content/system'
import { sample, shuffled } from '../random'
import type { LearnChooseRound, RoundGenerationInput, RoundGenerator } from '../types'
import { cardsForDeck, roundId } from './shared'

export class LearnChooseRoundGenerator implements RoundGenerator<LearnChooseRound> {
  generate(input: RoundGenerationInput): LearnChooseRound | null {
    const cards = cardsForDeck(input.deckId)
    const optionCount = Math.min(
      cards.length,
      input.difficulty >= 3 ? 4 : input.difficulty === 2 ? 3 : 2,
    )
    if (optionCount < 2) return null
    const teaching = sample(cards, Math.min(3, cards.length), input.rng)
    const target = teaching[input.roundIndex % teaching.length]
    if (!target) return null
    const options = sample(
      cards.filter((card) => card.id !== target.id),
      optionCount - 1,
      input.rng,
    )
    options.push(target)
    const title = CARDS_BY_ID.get(target.id)?.title ?? target.title
    return {
      id: roundId('learn', input.deckId, input.roundIndex),
      mode: 'LEARN_AND_CHOOSE',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: `Πού είναι ${title};`,
      narrationText: `Πού είναι ${title};`,
      skill: 'RECOGNITION',
      contentIds: [
        ...new Set([...teaching.map((card) => card.id), ...options.map((card) => card.id)]),
      ],
      teachingCardIds: teaching.map((card) => card.id),
      optionCardIds: shuffled(
        options.map((card) => card.id),
        input.rng,
      ),
      correctCardId: target.id,
    }
  }
}
