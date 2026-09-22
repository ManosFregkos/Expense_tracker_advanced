import { describe, expect, it } from 'vitest'
import {
  generateExplorerRounds,
  generateLogicRounds,
  generateMemoryRound,
  seededRandom,
} from './engine'
import { assets, worlds } from './content'

describe('Kids round generation', () => {
  it('makes deterministic missing-item rounds with unique choices', () => {
    for (const level of [1, 2, 3, 4]) {
      const round = generateMemoryRound(level, seededRandom(42), 0)
      expect(round).toEqual(generateMemoryRound(level, seededRandom(42), 0))
      expect(round.visible).toHaveLength(level + 2)
      expect(new Set(round.visible).size).toBe(round.visible.length)
      expect(new Set(round.choices).size).toBe(round.choices.length)
      expect(round.visible).toContain(round.missing)
      expect(round.choices.filter((id) => id === round.missing)).toHaveLength(1)
      expect(round.observeMs).toBe(level <= 2 ? 5000 : 4000)
    }
  })
  it('never asks an explorer mission without a visible hotspot and can fill long sessions', () => {
    for (const world of worlds) {
      const rounds = generateExplorerRounds(world.id, 1, 15, seededRandom(8))
      expect(rounds).toHaveLength(15)
      expect(new Set(rounds.map((item) => item.contentId)).size).toBe(15)
      for (const round of rounds)
        expect(world.objects.some((object) => object.id === round.targetId)).toBe(true)
    }
  })
  it('rejects archived, broken and ambiguous custom logic', () => {
    const good = {
      id: 'custom',
      title: 'Test',
      narrationText: 'Τι γίνεται;',
      illustrationAssetId: 'rain',
      difficulty: 1,
      skill: 'LOGIC' as const,
      options: [
        { id: 'one', assetId: 'umbrella', label: 'ομπρέλα', isPreferredAnswer: true },
        { id: 'two', assetId: 'pillow', label: 'μαξιλάρι', isPreferredAnswer: false },
      ],
    }
    const broken = {
      ...good,
      id: 'broken',
      options: [good.options[0]!, { ...good.options[1]!, assetId: 'umbrella' }],
    }
    const archived = { ...good, id: 'archived', enabled: false }
    const missing = { ...good, id: 'missing', illustrationAssetId: 'unknown' }
    const rounds = generateLogicRounds(1, 5, seededRandom(3), [broken, archived, missing, good])
    expect(rounds.some((round) => round.contentId === 'custom')).toBe(true)
    expect(
      rounds.some((round) => ['broken', 'archived', 'missing'].includes(round.contentId)),
    ).toBe(false)
    for (const round of rounds) {
      expect(round.scenario.options).toHaveLength(2)
      expect(round.scenario.options.filter((option) => option.isPreferredAnswer)).toHaveLength(1)
      expect(round.scenario.options.every((option) => Boolean(assets[option.assetId]))).toBe(true)
    }
  })
})
