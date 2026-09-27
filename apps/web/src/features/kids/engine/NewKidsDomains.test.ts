import {
  everydayScenarioSchema,
  learningRelationshipSchema,
  patternDefinitionSchema,
  spatialScenarioSchema,
} from '@family-expense-tracker/shared'
import { describe, expect, it } from 'vitest'
import { KIDS_ASSETS, CARDS_BY_ID } from '../content/system'
import { SYSTEM_PATTERNS } from '../content/system/patterns'
import { PROFESSION_RELATIONSHIPS } from '../content/system/professions'
import { SYSTEM_SPATIAL_SCENARIOS } from '../content/system/spatial'
import { SYSTEM_WEATHER_SCENARIOS } from '../content/system/weather/scenarios'
import { KidsRoundGenerator } from './KidsRoundGenerator'

const engine = new KidsRoundGenerator()

describe('patterns, spatial, weather and professions', () => {
  it('validates every authored definition and local asset reference', () => {
    expect(SYSTEM_PATTERNS).toHaveLength(13)
    expect(SYSTEM_SPATIAL_SCENARIOS).toHaveLength(8)
    expect(SYSTEM_WEATHER_SCENARIOS).toHaveLength(15)
    expect(PROFESSION_RELATIONSHIPS).toHaveLength(10)

    for (const definition of SYSTEM_PATTERNS) {
      expect(patternDefinitionSchema.safeParse(definition).success).toBe(true)
      for (const element of [...definition.elements, ...definition.distractorElements])
        expect(KIDS_ASSETS.has(element.assetId)).toBe(true)
    }
    for (const scenario of SYSTEM_SPATIAL_SCENARIOS) {
      expect(spatialScenarioSchema.safeParse(scenario).success).toBe(true)
      for (const choice of scenario.choices) expect(KIDS_ASSETS.has(choice.assetId)).toBe(true)
    }
    for (const scenario of SYSTEM_WEATHER_SCENARIOS) {
      expect(everydayScenarioSchema.safeParse(scenario).success).toBe(true)
      expect(scenario.topic).toBe('WEATHER')
      expect(scenario.explanationNarration).not.toBe('')
      for (const choice of scenario.choices) expect(KIDS_ASSETS.has(choice.assetId)).toBe(true)
    }
    for (const relationship of PROFESSION_RELATIONSHIPS) {
      expect(learningRelationshipSchema.safeParse(relationship).success).toBe(true)
      expect(CARDS_BY_ID.has(relationship.sourceCardId)).toBe(true)
      expect(CARDS_BY_ID.has(relationship.targetCardId)).toBe(true)
    }
  })

  it('generates deterministic, unique pattern and spatial rounds', () => {
    const patternInput = {
      mode: 'PATTERN_COMPLETE' as const,
      deckId: 'patterns',
      difficulty: 2 as const,
      roundCount: 10,
      seed: 42,
    }
    const patterns = engine.generateSession(patternInput)
    expect(engine.generateSession(patternInput)).toEqual(patterns)
    expect(patterns).toHaveLength(10)
    for (const round of patterns) {
      expect(round.mode).toBe('PATTERN_COMPLETE')
      if (round.mode !== 'PATTERN_COMPLETE') continue
      expect(round.options).toHaveLength(3)
      expect(new Set(round.options.map((option) => option.id)).size).toBe(3)
      expect(round.options.filter((option) => option.id === round.correctElementId)).toHaveLength(1)
      expect(round.slots.filter((slot) => slot.missing)).toHaveLength(1)
    }

    const spatialInput = {
      mode: 'SPATIAL_CONCEPT' as const,
      deckId: 'spatial',
      difficulty: 3 as const,
      roundCount: 8,
      seed: 17,
    }
    const spatial = engine.generateSession(spatialInput)
    expect(engine.generateSession(spatialInput)).toEqual(spatial)
    expect(spatial).toHaveLength(8)
    expect(new Set(spatial.flatMap((round) => round.mode === 'SPATIAL_CONCEPT' ? [round.concept] : []))).toEqual(
      new Set(['INSIDE', 'OUTSIDE', 'ABOVE', 'BELOW', 'IN_FRONT_OF', 'BEHIND', 'NEXT_TO', 'BETWEEN']),
    )
    for (const round of spatial) {
      if (round.mode !== 'SPATIAL_CONCEPT') continue
      expect(new Set(round.options.map((option) => option.id)).size).toBe(round.options.length)
      expect(round.options.filter((option) => option.id === round.correctChoiceId)).toHaveLength(1)
    }
  })

  it('keeps weather recommendations and tool-to-profession matches unambiguous', () => {
    const weather = engine.generateSession({
      mode: 'EVERYDAY_CHOICE',
      deckId: 'weather',
      difficulty: 2,
      roundCount: 15,
      seed: 8,
    })
    expect(weather).toHaveLength(15)
    for (const round of weather) {
      if (round.mode !== 'EVERYDAY_CHOICE') continue
      expect(round.conceptType).toBe('WEATHER')
      expect(round.options).toHaveLength(3)
      expect(new Set(round.options.map((option) => option.id)).size).toBe(round.options.length)
      expect(round.options.filter((option) => option.id === round.correctChoiceId)).toHaveLength(1)
    }

    const easyWeather = engine.generateSession({
      mode: 'EVERYDAY_CHOICE',
      deckId: 'weather',
      difficulty: 1,
      roundCount: 5,
      seed: 8,
    })
    expect(easyWeather.every((round) => round.mode === 'EVERYDAY_CHOICE' && round.options.length === 2)).toBe(true)

    const professions = engine.generateSession({
      mode: 'MATCHING',
      deckId: 'professions',
      difficulty: 3,
      roundCount: 10,
      seed: 9,
    })
    expect(professions).toHaveLength(10)
    for (const round of professions) {
      if (round.mode !== 'MATCHING') continue
      expect(CARDS_BY_ID.get(round.sourceCardId)?.category).toBe('PROFESSION_TOOL')
      expect(CARDS_BY_ID.get(round.correctCardId)?.category).toBe('PROFESSION')
      expect(new Set(round.optionCardIds).size).toBe(round.optionCardIds.length)
      expect(round.optionCardIds.filter((id) => id === round.correctCardId)).toHaveLength(1)
    }
  })
})
