import { SYSTEM_SPATIAL_SCENARIOS } from '../../content/system/spatial'
import { spatialConceptRoundSchema } from '@family-expense-tracker/shared'
import { shuffled } from '../random'
import type { RoundGenerationInput, RoundGenerator, SpatialConceptRound } from '../types'
import { roundId } from './shared'

export class SpatialConceptRoundGenerator implements RoundGenerator<SpatialConceptRound> {
  generate(input: RoundGenerationInput): SpatialConceptRound | null {
    const candidates = SYSTEM_SPATIAL_SCENARIOS.filter(
      (scenario) => scenario.enabled && scenario.difficulty <= input.difficulty,
    )
    const scenario = candidates[input.roundIndex % candidates.length]
    if (!scenario) return null
    const correct = scenario.choices.find((choice) => choice.id === scenario.correctChoiceId)
    if (!correct) return null
    const optionCount = input.difficulty === 1 ? 2 : 3
    const distractors = shuffled(
      scenario.choices.filter((choice) => choice.id !== correct.id),
      input.rng,
    ).slice(0, optionCount - 1)
    const options = shuffled([correct, ...distractors], input.rng)
    if (
      options.length < 2 ||
      new Set(options.map((choice) => choice.id)).size !== options.length ||
      new Set(options.map((choice) => choice.assetId)).size !== options.length ||
      options.filter((choice) => choice.id === correct.id).length !== 1
    )
      return null
    const round: SpatialConceptRound = {
      id: roundId('spatial', input.deckId, input.roundIndex),
      mode: 'SPATIAL_CONCEPT',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: scenario.narration,
      narrationText: scenario.narration,
      skill: `SPATIAL_${scenario.concept}`,
      contentIds: [scenario.id, ...options.map((choice) => choice.assetId)],
      conceptId: `spatial:${scenario.concept.toLowerCase().replaceAll('_', '-')}`,
      conceptType: 'SPATIAL',
      scenarioId: scenario.id,
      concept: scenario.concept,
      promptStyle: scenario.promptStyle,
      options,
      correctChoiceId: correct.id,
      explanationNarration: scenario.explanationNarration,
    }
    return spatialConceptRoundSchema.safeParse(round).success ? round : null
  }
}
