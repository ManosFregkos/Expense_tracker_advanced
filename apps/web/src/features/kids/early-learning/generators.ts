import type { KidsDifficulty } from '@family-expense-tracker/shared'
import { sample, shuffled } from '../engine/random'
import type {
  CompareQuantityRound,
  CountFingersRound,
  CountObjectsRound,
  FindFlagRound,
  LearnFlagRound,
  MatchFingersToNumberRound,
  MatchQuantityToNumberRound,
  RoundGenerationInput,
  RoundGenerator,
  SimpleSumRound,
} from '../engine/types'
import { COUNT_OBJECTS, EUROPEAN_COUNTRIES, FINGER_ASSETS, GREEK_NUMBER_WORDS, countryTeachingNarration } from './content'
import { asEarlyQuantity, type EarlyQuantity, type EuropeanCountry } from './types'

function limits(difficulty: KidsDifficulty) {
  return { maximum: difficulty === 1 ? 3 : 5, optionCount: difficulty === 1 ? 2 : 3 }
}

function quantityOptions(correct: EarlyQuantity, difficulty: KidsDifficulty, rng: () => number, configuredMaximum?: 3 | 5) {
  const level = limits(difficulty)
  const maximum = Math.max(correct, Math.min(level.maximum, configuredMaximum ?? 5))
  const { optionCount } = level
  const candidates = Array.from({ length: maximum }, (_, index) => asEarlyQuantity(index + 1)).filter(
    (quantity) => quantity !== correct,
  )
  const ordered = difficulty >= 3
    ? candidates.sort((left, right) => Math.abs(left - correct) - Math.abs(right - correct))
    : shuffled(candidates, rng)
  return shuffled([correct, ...ordered.slice(0, optionCount - 1)], rng)
}

function pickQuantity(input: RoundGenerationInput) {
  const maximum = Math.min(limits(input.difficulty).maximum, input.maximumQuantity ?? 5)
  return asEarlyQuantity(1 + Math.floor(input.rng() * maximum))
}

export class CountFingersRoundGenerator implements RoundGenerator<CountFingersRound> {
  generate(input: RoundGenerationInput): CountFingersRound {
    const quantity = pickQuantity(input)
    const finger = FINGER_ASSETS[quantity - 1]!
    return {
      id: `count-fingers-${input.roundIndex}-${quantity}`, mode: 'COUNT_FINGERS', difficulty: input.difficulty,
      deckId: input.deckId, instructionText: 'Πόσα δάχτυλα βλέπεις;', narrationText: 'Πόσα δάχτυλα βλέπεις;',
      skill: 'COUNTING', contentIds: [`number:${quantity}`], conceptId: `number:${quantity}`,
      fingerAssetId: finger.assetId, options: quantityOptions(quantity, input.difficulty, input.rng, input.maximumQuantity), correctQuantity: quantity,
    }
  }
}

export class MatchFingersToNumberRoundGenerator implements RoundGenerator<MatchFingersToNumberRound> {
  generate(input: RoundGenerationInput): MatchFingersToNumberRound {
    const quantity = pickQuantity(input)
    const direction = input.roundIndex % 2 === 0 ? 'NUMERAL_TO_FINGERS' : 'FINGERS_TO_NUMERAL'
    return {
      id: `match-fingers-${input.roundIndex}-${quantity}`, mode: 'MATCH_FINGERS_TO_NUMBER', difficulty: input.difficulty,
      deckId: input.deckId, instructionText: direction === 'NUMERAL_TO_FINGERS' ? `Ποιο χέρι δείχνει ${GREEK_NUMBER_WORDS[quantity]};` : 'Ποιος αριθμός ταιριάζει;',
      narrationText: direction === 'NUMERAL_TO_FINGERS' ? `Ποιο χέρι δείχνει ${GREEK_NUMBER_WORDS[quantity]};` : 'Ποιος αριθμός ταιριάζει με τα δάχτυλα;',
      skill: 'NUMBER_QUANTITY', contentIds: [`number:${quantity}`], conceptId: `number:${quantity}`,
      target: { quantity, type: direction === 'NUMERAL_TO_FINGERS' ? 'NUMERAL' : 'FINGERS', assetId: `fingers-${quantity}` },
      direction, options: quantityOptions(quantity, input.difficulty, input.rng, input.maximumQuantity), correctQuantity: quantity,
    }
  }
}

export class CountObjectsRoundGenerator implements RoundGenerator<CountObjectsRound> {
  generate(input: RoundGenerationInput): CountObjectsRound {
    const quantity = pickQuantity(input)
    const object = COUNT_OBJECTS[input.roundIndex % COUNT_OBJECTS.length]!
    const noun = quantity === 1 ? object.singularEl : object.pluralEl
    return {
      id: `count-objects-${input.roundIndex}-${quantity}`, mode: 'COUNT_OBJECTS', difficulty: input.difficulty,
      deckId: input.deckId, instructionText: `Πόσα ${noun} βλέπεις;`, narrationText: `Πόσα ${noun} βλέπεις;`,
      skill: 'COUNTING', contentIds: [`number:${quantity}`, object.id], conceptId: `number:${quantity}`,
      objectAssetId: object.id, renderedQuantity: quantity, options: quantityOptions(quantity, input.difficulty, input.rng, input.maximumQuantity), correctQuantity: quantity,
    }
  }
}

export class MatchQuantityToNumberRoundGenerator implements RoundGenerator<MatchQuantityToNumberRound> {
  generate(input: RoundGenerationInput): MatchQuantityToNumberRound {
    const quantity = pickQuantity(input)
    const object = COUNT_OBJECTS[input.roundIndex % COUNT_OBJECTS.length]!
    const direction = input.roundIndex % 2 === 0 ? 'NUMERAL_TO_QUANTITY' : 'QUANTITY_TO_NUMERAL'
    return {
      id: `match-quantity-${input.roundIndex}-${quantity}`, mode: 'MATCH_QUANTITY_TO_NUMBER', difficulty: input.difficulty,
      deckId: input.deckId, instructionText: direction === 'NUMERAL_TO_QUANTITY' ? `Πού είναι τα ${GREEK_NUMBER_WORDS[quantity]};` : 'Ποιος αριθμός ταιριάζει;',
      narrationText: direction === 'NUMERAL_TO_QUANTITY' ? `Πού είναι τα ${GREEK_NUMBER_WORDS[quantity]};` : 'Ποιος αριθμός ταιριάζει με την ομάδα;',
      skill: 'NUMBER_QUANTITY', contentIds: [`number:${quantity}`, object.id], conceptId: `number:${quantity}`,
      direction, objectAssetId: object.id, options: quantityOptions(quantity, input.difficulty, input.rng, input.maximumQuantity), correctQuantity: quantity,
    }
  }
}

export class CompareQuantityRoundGenerator implements RoundGenerator<CompareQuantityRound> {
  generate(input: RoundGenerationInput): CompareQuantityRound {
    const maximum = limits(input.difficulty).maximum
    const left = asEarlyQuantity(1 + Math.floor(input.rng() * maximum))
    let right = asEarlyQuantity(1 + Math.floor(input.rng() * maximum))
    while (right === left) right = asEarlyQuantity(1 + Math.floor(input.rng() * maximum))
    const relation = input.roundIndex % 2 === 0 ? 'MORE' : 'LESS'
    const correctSide = relation === 'MORE' ? (left > right ? 'LEFT' : 'RIGHT') : left < right ? 'LEFT' : 'RIGHT'
    const object = COUNT_OBJECTS[input.roundIndex % COUNT_OBJECTS.length]!
    return {
      id: `compare-quantity-${input.roundIndex}`, mode: 'COMPARE_QUANTITY', difficulty: input.difficulty, deckId: input.deckId,
      instructionText: relation === 'MORE' ? 'Πού είναι περισσότερα;' : 'Πού είναι λιγότερα;',
      narrationText: relation === 'MORE' ? 'Πού είναι περισσότερα;' : 'Πού είναι λιγότερα;', skill: 'QUANTITY_COMPARE',
      contentIds: [`quantity:${relation.toLowerCase()}`], relation, correctSide,
      conceptId: relation === 'MORE' ? 'quantity:more' : 'quantity:less',
      left: { quantity: left, type: 'OBJECTS', objectAssetId: object.id }, right: { quantity: right, type: 'OBJECTS', objectAssetId: object.id },
    }
  }
}

const VALID_SUMS = [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 2], [1, 4], [4, 1], [2, 3], [3, 2]] as const

export class SimpleSumRoundGenerator implements RoundGenerator<SimpleSumRound> {
  generate(input: RoundGenerationInput): SimpleSumRound {
    const adaptiveMaximum = input.difficulty === 1 ? 3 : input.difficulty === 2 ? 4 : 5
    const maxResult = Math.min(adaptiveMaximum, input.maximumSum ?? 5)
    const valid = VALID_SUMS.filter(([left, right]) => left + right <= maxResult)
    const [leftValue, rightValue] = valid[Math.floor(input.rng() * valid.length)]!
    const left = asEarlyQuantity(leftValue); const right = asEarlyQuantity(rightValue); const result = asEarlyQuantity(left + right)
    const stage = input.difficulty <= 2 ? 'CONCRETE' : input.difficulty === 3 ? 'VISUAL_NUMERAL' : 'NUMERAL'
    return {
      id: `simple-sum-${input.roundIndex}-${left}-${right}`, mode: 'SIMPLE_SUM', difficulty: input.difficulty, deckId: input.deckId,
      instructionText: 'Πόσα είναι όλα μαζί;', narrationText: `${GREEK_NUMBER_WORDS[left]} και ${GREEK_NUMBER_WORDS[right]} ακόμα. Πόσα είναι όλα μαζί;`,
      skill: 'ADDITION', contentIds: [`number:${result}`, `addition:within-${maxResult <= 3 ? 3 : 5}`],
      conceptId: maxResult <= 3 ? 'addition:within-3' : 'addition:within-5', correctQuantity: result,
      options: quantityOptions(result, input.difficulty, input.rng, maxResult <= 3 ? 3 : 5), stage,
      sum: { left, right, result, representation: stage === 'CONCRETE' ? 'FINGERS' : 'FINGERS_AND_NUMERALS' },
    }
  }
}

export class FlagDistractorSelector {
  select(correct: EuropeanCountry, pool: readonly EuropeanCountry[], difficulty: KidsDifficulty, count: number, rng: () => number, recentIds: ReadonlySet<string> = new Set<string>()) {
    const similar = new Set(correct.similarFlagCountryIds ?? [])
    const candidates = pool.filter((country) => country.id !== correct.id)
    const preferred = candidates.filter((country) => difficulty >= 3 ? similar.has(country.id) : !similar.has(country.id))
    const fallback = candidates.filter((country) => !preferred.includes(country)).sort((a, b) => Number(recentIds.has(a.id)) - Number(recentIds.has(b.id)))
    return sample([...preferred, ...fallback], count, rng)
  }
}

function flagPool(input: RoundGenerationInput) {
  const adaptiveTier = input.difficulty === 1 ? 1 : input.difficulty <= 3 ? 2 : 3
  const tier = Math.min(adaptiveTier, input.flagTier ?? 3)
  const pool = EUROPEAN_COUNTRIES.filter((country) => country.enabled && country.difficultyTier <= tier)
  const preferred = input.preferredCardIds ?? []
  return pool.sort((left, right) => {
    const leftIndex = preferred.indexOf(`flag:${left.iso2}`)
    const rightIndex = preferred.indexOf(`flag:${right.iso2}`)
    if (leftIndex < 0 && rightIndex < 0) return 0
    if (leftIndex < 0) return -1
    if (rightIndex < 0) return 1
    return leftIndex - rightIndex
  })
}

export class LearnFlagRoundGenerator implements RoundGenerator<LearnFlagRound> {
  generate(input: RoundGenerationInput): LearnFlagRound {
    const pool = flagPool(input)
    const country = pool[input.roundIndex % Math.min(pool.length, input.newFlagsPerSession ?? 3)]!
    return { id: `learn-flag-${input.roundIndex}-${country.iso2}`, mode: 'LEARN_FLAG', difficulty: input.difficulty, deckId: input.deckId,
      instructionText: country.nameEl, narrationText: countryTeachingNarration(country), skill: 'FLAG_RECOGNITION', contentIds: [country.id],
      countryId: country.id, flagAssetId: country.flagAssetId, conceptId: `flag:${country.iso2}` }
  }
}

export class FindFlagRoundGenerator implements RoundGenerator<FindFlagRound> {
  generate(input: RoundGenerationInput): FindFlagRound {
    const pool = flagPool(input)
    const challenging = input.difficulty === 4 ? pool.filter((item) => item.difficultyTier === 3) : []
    const country = challenging.length && input.roundIndex % 3 === 2
      ? challenging[input.roundIndex % challenging.length]!
      : pool[input.roundIndex % pool.length]!
    const count = input.difficulty === 1 ? 2 : input.difficulty === 4 ? 4 : 3
    const distractors = new FlagDistractorSelector().select(country, pool, input.difficulty, count - 1, input.rng, input.recentContentIds)
    return { id: `find-flag-${input.roundIndex}-${country.iso2}`, mode: 'FIND_FLAG', difficulty: input.difficulty, deckId: input.deckId,
      instructionText: `Πού είναι η σημαία της ${country.genitiveEl};`, narrationText: `Πού είναι η σημαία της ${country.genitiveEl};`, skill: 'FLAG_RECOGNITION',
      contentIds: [country.id, ...distractors.map((item) => item.id)], countryId: country.id, correctCountryId: country.id,
      optionCountryIds: shuffled([country, ...distractors], input.rng).map((item) => item.id), conceptId: `flag:${country.iso2}` }
  }
}
