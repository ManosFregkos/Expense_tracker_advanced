import { describe, expect, it } from 'vitest'
import { nextKidsDifficulty } from './kids-difficulty.js'

describe('Kids difficulty hysteresis', () => {
  it('increases once after sustained success', () => {
    expect(nextKidsDifficulty(1, [true, true, true, true, true, true], 5, 'AUTO')).toBe(2)
    expect(nextKidsDifficulty(2, [true, true, true, true, true, true], 0, 'AUTO')).toBe(2)
  })
  it('holds mixed results and reduces after repeated struggles', () => {
    expect(nextKidsDifficulty(2, [true, false, true, false, true, false], 6, 'AUTO')).toBe(2)
    expect(nextKidsDifficulty(2, [false, false, true, false, true, false], 6, 'AUTO')).toBe(1)
  })
  it('respects bounds and fixed parent settings', () => {
    expect(nextKidsDifficulty(4, [true, true, true, true, true, true], 8, 'AUTO')).toBe(4)
    expect(nextKidsDifficulty(1, [false, false, false, false, false, false], 8, 'AUTO')).toBe(1)
    expect(nextKidsDifficulty(2, [true, true, true, true, true, true], 8, 'HARD')).toBe(2)
  })
})
