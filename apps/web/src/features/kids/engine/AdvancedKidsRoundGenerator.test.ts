import { describe, expect, it } from 'vitest'
import {
  SYSTEM_CLASSIFICATION_RELATIONSHIPS,
  SYSTEM_EMOTION_SCENARIOS,
  SYSTEM_EVERYDAY_SCENARIOS,
  SYSTEM_SEQUENCES,
} from '../content/system/advanced'
import { KidsRoundGenerator } from './KidsRoundGenerator'

const engine = new KidsRoundGenerator()

describe('advanced Kids round generation', () => {
  it('ships the curated advanced content set with stable authored definitions', () => {
    expect(SYSTEM_EVERYDAY_SCENARIOS).toHaveLength(29)
    expect(SYSTEM_CLASSIFICATION_RELATIONSHIPS).toHaveLength(12)
    expect(SYSTEM_SEQUENCES).toHaveLength(16)
    expect(SYSTEM_EMOTION_SCENARIOS).toHaveLength(18)
  })

  it.each([
    ['EVERYDAY_CHOICE', 'everyday'],
    ['CLASSIFY', 'household'],
    ['SEQUENCE', 'sequences'],
    ['EMOTION', 'emotions'],
    ['MEMORY_PAIRS', 'animals'],
  ] as const)('creates deterministic valid %s rounds', (mode, deckId) => {
    const input = { mode, deckId, difficulty: 2 as const, roundCount: 5, seed: 42 }
    const rounds = engine.generateSession(input)
    expect(rounds).toHaveLength(5)
    expect(engine.generateSession(input)).toEqual(rounds)
    for (const round of rounds) {
      if (round.mode === 'EVERYDAY_CHOICE') {
        expect(round.options).toHaveLength(2)
        expect(round.options.filter((item) => item.id === round.correctChoiceId)).toHaveLength(1)
      }
      if (round.mode === 'CLASSIFY') {
        expect(new Set(round.destinationIds).size).toBe(round.destinationIds.length)
        expect(round.destinationIds.filter((id) => id === round.correctDestinationId)).toHaveLength(
          1,
        )
      }
      if (round.mode === 'SEQUENCE') {
        expect(round.slots.filter((slot) => slot.missing)).toHaveLength(1)
        expect(round.optionSteps.filter((step) => step.id === round.correctStepId)).toHaveLength(1)
      }
      if (round.mode === 'EMOTION') {
        expect(new Set(round.options).size).toBe(round.options.length)
        expect(round.options.filter((item) => item === round.expectedEmotion)).toHaveLength(1)
      }
      if (round.mode === 'MEMORY_PAIRS') {
        expect(round.cards).toHaveLength(6)
        for (const pairId of new Set(round.cards.map((card) => card.pairId)))
          expect(round.cards.filter((card) => card.pairId === pairId)).toHaveLength(2)
      }
    }
  })

  it('plans mixed sessions without three identical modes in a row', () => {
    const rounds = engine.generateSession({
      mode: 'MIXED_PLAY',
      deckId: 'animals',
      difficulty: 2,
      roundCount: 10,
      seed: 8,
    })
    expect(rounds).toHaveLength(10)
    for (let index = 2; index < rounds.length; index += 1) {
      expect(
        new Set(rounds.slice(index - 2, index + 1).map((round) => round.mode)).size,
      ).toBeGreaterThan(1)
    }
  })
})
