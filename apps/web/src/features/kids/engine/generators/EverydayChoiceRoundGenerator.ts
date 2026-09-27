import { SYSTEM_EVERYDAY_SCENARIOS } from '../../content/system/advanced'
import { SYSTEM_WEATHER_SCENARIOS } from '../../content/system/weather/scenarios'
import { shuffled } from '../random'
import type { EverydayChoiceRound, RoundGenerationInput, RoundGenerator } from '../types'
import { roundId } from './shared'

export class EverydayChoiceRoundGenerator implements RoundGenerator<EverydayChoiceRound> {
  generate(input: RoundGenerationInput): EverydayChoiceRound | null {
    const allScenarios = [...SYSTEM_EVERYDAY_SCENARIOS, ...SYSTEM_WEATHER_SCENARIOS]
    const candidates = allScenarios.filter(
      (scenario) =>
        scenario.enabled &&
        scenario.difficulty <= input.difficulty &&
        (input.deckId === 'weather' ? scenario.topic === 'WEATHER' : scenario.topic !== 'WEATHER'),
    )
    const scenario = candidates[input.roundIndex % candidates.length]
    if (!scenario) return null
    const ids = scenario.choices.map((choice) => choice.id)
    if (
      new Set(ids).size !== ids.length ||
      ids.filter((id) => id === scenario.preferredChoiceId).length !== 1
    )
      return null
    const choices =
      scenario.topic === 'WEATHER'
        ? shuffled(
            [
              scenario.choices.find((choice) => choice.id === scenario.preferredChoiceId)!,
              ...shuffled(
                scenario.choices.filter((choice) => choice.id !== scenario.preferredChoiceId),
                input.rng,
              ).slice(0, input.difficulty === 1 ? 1 : 2),
            ],
            input.rng,
          )
        : shuffled(scenario.choices, input.rng)
    return {
      id: roundId('everyday', input.deckId, input.roundIndex),
      mode: 'EVERYDAY_CHOICE',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: scenario.narration,
      narrationText: scenario.narration,
      skill: scenario.topic === 'SAFETY' ? 'SAFETY' : 'DAILY_ROUTINE',
      contentIds: [scenario.id, ...choices.map((choice) => choice.id)],
      ...(scenario.topic === 'WEATHER' && scenario.subtopic
        ? {
            conceptId: `weather:${scenario.subtopic.toLowerCase()}`,
            conceptType: 'WEATHER' as const,
          }
        : {}),
      scenarioId: scenario.id,
      ...(scenario.situationAssetId ? { situationAssetId: scenario.situationAssetId } : {}),
      options: choices,
      correctChoiceId: scenario.preferredChoiceId,
      explanationNarration: scenario.explanationNarration,
    }
  }
}
