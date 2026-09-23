import { SYSTEM_EMOTION_SCENARIOS } from '../../content/system/advanced'
import { shuffled } from '../random'
import type { EmotionRound, RoundGenerationInput, RoundGenerator } from '../types'
import { roundId } from './shared'

export class EmotionRoundGenerator implements RoundGenerator<EmotionRound> {
  generate(input: RoundGenerationInput): EmotionRound | null {
    const candidates = SYSTEM_EMOTION_SCENARIOS.filter(
      (scenario) => scenario.enabled && scenario.difficulty <= input.difficulty,
    )
    const scenario = candidates[input.roundIndex % candidates.length]
    if (!scenario) return null
    if (
      new Set(scenario.options).size !== scenario.options.length ||
      scenario.options.filter((item) => item === scenario.expectedEmotion).length !== 1
    )
      return null
    return {
      id: roundId('emotion', input.deckId, input.roundIndex),
      mode: 'EMOTION',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: scenario.narration,
      narrationText: scenario.narration,
      skill: 'EMOTION_RECOGNITION',
      contentIds: [scenario.id, scenario.sceneAssetId],
      scenarioId: scenario.id,
      sceneAssetId: scenario.sceneAssetId,
      options: shuffled(scenario.options, input.rng),
      expectedEmotion: scenario.expectedEmotion,
      ...(scenario.explanationNarration
        ? { explanationNarration: scenario.explanationNarration }
        : {}),
    }
  }
}
