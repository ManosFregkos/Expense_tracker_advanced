import {
  applySpacedLearning,
  SPACED_LEARNING_MIX,
  type LearningMemorySnapshot,
} from '@family-expense-tracker/shared'

export class SpacedLearningService {
  readonly recommendedMix = SPACED_LEARNING_MIX

  applyAttempt(progress: LearningMemorySnapshot, correct: boolean) {
    return applySpacedLearning(progress, correct)
  }
}
