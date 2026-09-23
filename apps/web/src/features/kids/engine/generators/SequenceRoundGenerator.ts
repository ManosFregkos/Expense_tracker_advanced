import { SYSTEM_SEQUENCES } from '../../content/system/advanced'
import { sample, shuffled } from '../random'
import type { RoundGenerationInput, RoundGenerator, SequenceRound } from '../types'
import { roundId } from './shared'

export class SequenceRoundGenerator implements RoundGenerator<SequenceRound> {
  generate(input: RoundGenerationInput): SequenceRound | null {
    const candidates = SYSTEM_SEQUENCES.filter(
      (sequence) =>
        sequence.enabled && sequence.difficulty <= input.difficulty && sequence.steps.length >= 3,
    )
    const sequence = candidates[input.roundIndex % candidates.length]
    if (!sequence) return null
    const missingIndex = input.difficulty >= 3 ? 1 : 2
    const correct = sequence.steps[missingIndex]
    if (!correct) return null
    const allOtherSteps = SYSTEM_SEQUENCES.flatMap((item) => item.steps).filter(
      (step) => !sequence.steps.some((own) => own.id === step.id),
    )
    const distractors = sample(allOtherSteps, input.difficulty >= 2 ? 2 : 1, input.rng)
    if (!distractors.length) return null
    return {
      id: roundId('sequence', input.deckId, input.roundIndex),
      mode: 'SEQUENCE',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: sequence.narration,
      narrationText: sequence.narration,
      skill: 'SEQUENCING',
      contentIds: [
        sequence.id,
        ...sequence.steps.map((step) => step.id),
        ...distractors.map((step) => step.id),
      ],
      sequenceId: sequence.id,
      slots: sequence.steps.slice(0, 3).map((step, index) =>
        index === missingIndex
          ? { stepId: step.id, missing: true }
          : {
              stepId: step.id,
              assetId: step.assetId,
              narration: step.narration,
              missing: false,
            },
      ),
      optionSteps: shuffled([correct, ...distractors], input.rng),
      correctStepId: correct.id,
      missingIndex,
      ...(sequence.explanationNarration
        ? { explanationNarration: sequence.explanationNarration }
        : {}),
    }
  }
}
