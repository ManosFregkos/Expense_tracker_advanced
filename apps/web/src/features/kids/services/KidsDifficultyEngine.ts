import {
  DIFFICULTY_CONFIG,
  updateModeDifficulty,
  type KidsDifficulty,
  type ModeDifficultyState,
} from '@family-expense-tracker/shared'

export class KidsDifficultyEngine {
  readonly config = DIFFICULTY_CONFIG

  applyAttempt(
    state: ModeDifficultyState | undefined,
    fallbackLevel: KidsDifficulty,
    attempt: { success: boolean; usedHint: boolean },
  ) {
    return updateModeDifficulty(state, fallbackLevel, attempt)
  }
}
