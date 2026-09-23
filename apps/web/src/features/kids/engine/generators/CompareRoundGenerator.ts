import {
  SYSTEM_COMPARISONS,
  type SystemComparison,
} from '../../content/system/comparisons/comparisons'
import { shuffled } from '../random'
import type { CompareRound, RoundGenerationInput, RoundGenerator } from '../types'
import { cardsForDeck, roundId } from './shared'

export class CompareRoundGenerator implements RoundGenerator<CompareRound> {
  generate(input: RoundGenerationInput): CompareRound | null {
    const candidates = SYSTEM_COMPARISONS.filter((item) => item.deckId === input.deckId)
    let comparison: SystemComparison | undefined = candidates[input.roundIndex % candidates.length]
    if (!comparison) {
      const cards = cardsForDeck(input.deckId)
      const countCards = cards.filter((card) => card.attributes?.count !== undefined)
      const sizeRank: Record<string, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3, SHORT: 1, TALL: 3 }
      const sizeCards = cards.filter((card) => sizeRank[card.attributes?.size ?? ''] !== undefined)
      const source = countCards.length >= 2 ? countCards : sizeCards
      const extractor = (card: (typeof cards)[number]) =>
        card.attributes?.count ?? sizeRank[card.attributes?.size ?? ''] ?? 0
      const first = source.find((card, index) =>
        source.slice(index + 1).some((other) => extractor(card) !== extractor(other)),
      )
      const second = first ? source.find((card) => extractor(card) !== extractor(first)) : undefined
      if (!first || !second) return null
      const pair = [first, second] as const
      const values = pair.map(extractor)
      const correctIndex = values[0]! > values[1]! ? 0 : 1
      comparison = {
        id: `custom-compare-${input.deckId}`,
        deckId: input.deckId,
        relation: countCards.length >= 2 ? 'MORE' : 'BIGGER',
        instruction: countCards.length >= 2 ? 'Ποιο έχει περισσότερα;' : 'Ποιο είναι μεγαλύτερο;',
        options: [
          { cardId: pair[0]!.id, numericValue: values[0]! },
          { cardId: pair[1]!.id, numericValue: values[1]! },
        ],
        correctCardId: pair[correctIndex]!.id,
      }
    }
    if (!comparison.options.some((option) => option.cardId === comparison.correctCardId))
      return null
    const numericValues = comparison.options.flatMap((option) => option.numericValue ?? [])
    if (numericValues.length === 2 && numericValues[0] === numericValues[1]) return null
    const relationValues = comparison.options.flatMap((option) => option.relationValue ?? [])
    if (relationValues.length === 2 && relationValues[0] === relationValues[1]) return null
    return {
      id: roundId('compare', input.deckId, input.roundIndex),
      mode: 'COMPARE',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: comparison.instruction,
      narrationText: comparison.instruction,
      skill: `COMPARE_${comparison.relation}`,
      contentIds: comparison.options.map((option) => option.cardId),
      relation: comparison.relation,
      options: shuffled(comparison.options, input.rng).map((option) => ({ ...option })),
      correctCardId: comparison.correctCardId,
    }
  }
}
