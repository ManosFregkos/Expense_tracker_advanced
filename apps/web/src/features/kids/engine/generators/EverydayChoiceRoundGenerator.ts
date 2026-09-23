import { SYSTEM_EVERYDAY_SCENARIOS } from '../../content/system/advanced'
import { shuffled } from '../random'
import type { EverydayChoiceRound, RoundGenerationInput, RoundGenerator } from '../types'
import { roundId } from './shared'

export class EverydayChoiceRoundGenerator implements RoundGenerator<EverydayChoiceRound> {
  generate(input: RoundGenerationInput): EverydayChoiceRound | null {
    const candidates = SYSTEM_EVERYDAY_SCENARIOS.filter(
      (scenario) => scenario.enabled && scenario.difficulty <= input.difficulty,
    )
    const scenario = candidates[input.roundIndex % candidates.length]
    if (!scenario) return null
    const ids = scenario.choices.map((choice) => choice.id)
    if (
      new Set(ids).size !== ids.length ||
      ids.filter((id) => id === scenario.preferredChoiceId).length !== 1
    )
      return null
    return {
      id: roundId('everyday', input.deckId, input.roundIndex),
      mode: 'EVERYDAY_CHOICE',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: scenario.narration,
      narrationText: scenario.narration,
      skill: scenario.topic === 'SAFETY' ? 'SAFETY' : 'DAILY_ROUTINE',
      contentIds: [scenario.id, ...ids],
      scenarioId: scenario.id,
      ...(scenario.situationAssetId ? { situationAssetId: scenario.situationAssetId } : {}),
      options: shuffled(scenario.choices, input.rng),
      correctChoiceId: scenario.preferredChoiceId,
      explanationNarration: scenario.explanationNarration,
    }
  }
}
