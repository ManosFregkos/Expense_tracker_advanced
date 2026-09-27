import { SYSTEM_PATTERNS } from '../../content/system/patterns'
import { patternCompleteRoundSchema } from '@family-expense-tracker/shared'
import { shuffled } from '../random'
import type { PatternCompleteRound, RoundGenerationInput, RoundGenerator } from '../types'
import { roundId } from './shared'

export class PatternCompleteRoundGenerator implements RoundGenerator<PatternCompleteRound> {
  generate(input: RoundGenerationInput): PatternCompleteRound | null {
    const candidates = SYSTEM_PATTERNS.filter(
      (pattern) => pattern.enabled && pattern.difficulty <= input.difficulty,
    )
    const pattern = candidates[input.roundIndex % candidates.length]
    if (!pattern || pattern.elements[pattern.missingIndex]?.id !== pattern.correctElement.id)
      return null
    const optionCount = input.difficulty === 1 ? 2 : 3
    const answers = [pattern.correctElement, ...pattern.distractorElements]
    const uniqueAnswers = [...new Map(answers.map((element) => [element.id, element])).values()]
    if (uniqueAnswers.length < optionCount) return null
    const options = shuffled(
      [
        pattern.correctElement,
        ...shuffled(
          uniqueAnswers.filter((element) => element.id !== pattern.correctElement.id),
          input.rng,
        ).slice(0, optionCount - 1),
      ],
      input.rng,
    )
    if (options.filter((element) => element.id === pattern.correctElement.id).length !== 1)
      return null
    const round: PatternCompleteRound = {
      id: roundId('pattern', input.deckId, input.roundIndex),
      mode: 'PATTERN_COMPLETE',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: pattern.narration,
      narrationText: pattern.narration,
      skill: `PATTERN_${pattern.type}`,
      contentIds: [pattern.id, ...new Set(pattern.elements.map((element) => element.assetId))],
      conceptId: `pattern:${pattern.type.toLowerCase()}-${pattern.category.toLowerCase()}`,
      conceptType: 'PATTERN',
      patternId: pattern.id,
      patternType: pattern.type,
      slots: pattern.elements.map((element, index) => ({
        ...element,
        missing: index === pattern.missingIndex,
      })),
      options,
      correctElementId: pattern.correctElement.id,
      explanationNarration: pattern.explanationNarration,
    }
    return patternCompleteRoundSchema.safeParse(round).success ? round : null
  }
}
