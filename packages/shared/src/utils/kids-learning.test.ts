import { describe, expect, it } from 'vitest'
import {
  applySpacedLearning,
  updateModeDifficulty,
  type LearningMemorySnapshot,
  type ModeDifficultyState,
} from './kids-learning'

describe('Kids learning rules', () => {
  it('moves learning status conservatively and revisits familiar cards after repeated misses', () => {
    let memory: LearningMemorySnapshot = {
      exposureCount: 0,
      recognitionAttempts: 0,
      recognitionSuccesses: 0,
      consecutiveSuccesses: 0,
      recentMisses: 0,
      status: 'NEW',
    }
    memory = applySpacedLearning(memory, true)
    expect(memory.status).toBe('LEARNING')
    memory = applySpacedLearning(memory, true)
    memory = applySpacedLearning(memory, false)
    memory = applySpacedLearning(memory, true)
    memory = applySpacedLearning(memory, true)
    expect(memory.status).toBe('FAMILIAR')
    memory = applySpacedLearning(memory, false)
    expect(memory.status).toBe('FAMILIAR')
    memory = applySpacedLearning(memory, false)
    expect(memory.status).toBe('LEARNING')
  })

  it('raises and lowers bounded per-mode difficulty with a cooldown', () => {
    let state: ModeDifficultyState | undefined
    for (let index = 0; index < 6; index += 1)
      state = updateModeDifficulty(state, 1, { success: true, usedHint: false })
    expect(state!.level).toBe(2)
    const unchanged = updateModeDifficulty(state, 1, { success: false, usedHint: true })
    expect(unchanged.level).toBe(2)
    let struggling: ModeDifficultyState | undefined
    for (let index = 0; index < 6; index += 1)
      struggling = updateModeDifficulty(struggling, 3, { success: false, usedHint: true })
    expect(struggling!.level).toBe(2)
  })
})
