import { describe, expect, it } from 'vitest'
import { KIDS_COMPARE_RELATIONS, type KidsCardGameMode } from '@family-expense-tracker/shared'
import {
  SYSTEM_COMPARISONS,
  type SystemComparison,
} from '../content/system/comparisons/comparisons'
import { CARDS_BY_ID, SYSTEM_RELATIONSHIPS } from '../content/system'
import { KidsRoundGenerator } from './KidsRoundGenerator'
import { SameDifferentRoundGenerator } from './generators/SameDifferentRoundGenerator'
import { seededRandom } from './random'

const engine = new KidsRoundGenerator()

describe('KidsRoundGenerator', () => {
  it('reproduces seeded rounds and teaches a target before recognition', () => {
    const input = {
      mode: 'LEARN_AND_CHOOSE' as const,
      deckId: 'animals',
      difficulty: 2 as const,
      roundCount: 5,
      seed: 42,
    }
    const first = engine.generateSession(input)
    expect(engine.generateSession(input)).toEqual(first)
    expect(first).toHaveLength(5)
    for (const round of first) {
      expect(round.mode).toBe('LEARN_AND_CHOOSE')
      if (round.mode !== 'LEARN_AND_CHOOSE') continue
      expect(round.teachingCardIds).toContain(round.correctCardId)
      expect(round.optionCardIds).toContain(round.correctCardId)
      expect(new Set(round.optionCardIds).size).toBe(round.optionCardIds.length)
      expect(round.optionCardIds).toHaveLength(3)
    }
  })

  it.each<[KidsCardGameMode, string]>([
    ['SAME_OR_DIFFERENT', 'colors'],
    ['MATCHING', 'household'],
    ['ODD_ONE_OUT', 'fruits'],
    ['COMPARE', 'animals'],
  ])('creates deterministic, unambiguous %s rounds', (mode, deckId) => {
    const rounds = engine.generateSession({ mode, deckId, difficulty: 2, roundCount: 5, seed: 9 })
    expect(rounds).toHaveLength(5)
    for (const round of rounds) {
      if (round.mode === 'MATCHING') {
        expect(new Set(round.optionCardIds).size).toBe(round.optionCardIds.length)
        expect(round.optionCardIds).toContain(round.correctCardId)
        const validTargets = SYSTEM_RELATIONSHIPS.filter(
          (item) => item.sourceCardId === round.sourceCardId,
        ).map((item) => item.targetCardId)
        expect(round.optionCardIds.filter((id) => validTargets.includes(id))).toEqual([
          round.correctCardId,
        ])
      }
      if (round.mode === 'ODD_ONE_OUT') {
        const categories = round.optionCardIds.map((id) => CARDS_BY_ID.get(id)?.category)
        expect(categories.filter((category) => category !== round.sharedCategory)).toHaveLength(1)
      }
      if (round.mode === 'COMPARE') {
        expect(
          round.options.filter((option) => option.cardId === round.correctCardId),
        ).toHaveLength(1)
      }
    }
  })

  it('uses explicit detail metadata at difficulty four', () => {
    const round = new SameDifferentRoundGenerator().generate({
      deckId: 'shapes',
      difficulty: 4,
      roundIndex: 1,
      rng: seededRandom(1),
    })
    expect(round?.comparisonDimension).toBe('DETAIL')
    expect(round?.correctAnswer).toBe('DIFFERENT')
  })

  it('defines one deterministic answer for every supported comparison relation', () => {
    expect(new Set(SYSTEM_COMPARISONS.map((item) => item.relation))).toEqual(
      new Set(KIDS_COMPARE_RELATIONS),
    )
    for (const comparison of SYSTEM_COMPARISONS as SystemComparison[]) {
      expect(comparison.options).toHaveLength(2)
      expect(
        comparison.options.filter((option) => option.cardId === comparison.correctCardId),
      ).toHaveLength(1)
      const values = comparison.options.map((option) => option.numericValue ?? option.relationValue)
      expect(values[0]).not.toBe(values[1])
    }
  })
})
