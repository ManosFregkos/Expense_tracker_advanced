import { SYSTEM_COMPARISONS } from '../../content/system/comparisons/comparisons'
import { shuffled } from '../random'
import type { CompareRound, RoundGenerationInput, RoundGenerator } from '../types'
import { roundId } from './shared'

export class CompareRoundGenerator implements RoundGenerator<CompareRound> {
  generate(input: RoundGenerationInput): CompareRound | null {
    const candidates = SYSTEM_COMPARISONS.filter((item) => item.deckId === input.deckId)
    const comparison = candidates[input.roundIndex % candidates.length]
    if (!comparison) return null
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
