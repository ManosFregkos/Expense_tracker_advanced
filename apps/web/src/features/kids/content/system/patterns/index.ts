import type { PatternDefinition, PatternElement } from '@family-expense-tracker/shared'
import type { IllustratedAsset } from '../advanced'

type ElementSeed = readonly [id: string, assetId: string, narration: string, value: string]

const ELEMENTS = {
  red: ['pattern-red', 'pattern-red', 'κόκκινο', 'red'],
  blue: ['pattern-blue', 'pattern-blue', 'μπλε', 'blue'],
  yellow: ['pattern-yellow', 'pattern-yellow', 'κίτρινο', 'yellow'],
  circle: ['pattern-circle', 'pattern-circle', 'κύκλος', 'circle'],
  triangle: ['pattern-triangle', 'pattern-triangle', 'τρίγωνο', 'triangle'],
  square: ['pattern-square', 'pattern-square', 'τετράγωνο', 'square'],
  apple: ['pattern-apple', 'pattern-apple', 'μήλο', 'apple'],
  banana: ['pattern-banana', 'pattern-banana', 'μπανάνα', 'banana'],
  ball: ['pattern-ball', 'pattern-ball', 'μπάλα', 'ball'],
  flower: ['pattern-flower', 'pattern-flower', 'λουλούδι', 'flower'],
  fish: ['pattern-fish', 'pattern-fish', 'ψάρι', 'fish'],
  star: ['pattern-star', 'pattern-star', 'αστέρι', 'star'],
} as const satisfies Record<string, ElementSeed>

type ElementKey = keyof typeof ELEMENTS

const semanticFor = (key: ElementKey): PatternElement['semanticType'] =>
  ['red', 'blue', 'yellow'].includes(key)
    ? 'COLOR'
    : ['circle', 'triangle', 'square', 'star'].includes(key)
      ? 'SHAPE'
      : 'OBJECT'

function element(key: ElementKey): PatternElement {
  const [id, assetId, narration, value] = ELEMENTS[key]
  return { id, assetId, narration, value, semanticType: semanticFor(key) }
}

function pattern(
  id: string,
  type: PatternDefinition['type'],
  keys: ElementKey[],
  missingIndex: number,
  distractors: ElementKey[],
  difficulty: PatternDefinition['difficulty'],
  explanationNarration: string,
): PatternDefinition {
  const elements = keys.map(element)
  const correctElement = elements[missingIndex]!
  return {
    id,
    type,
    elements,
    missingIndex,
    correctElement,
    distractorElements: distractors.map(element),
    narration: difficulty === 1 ? 'Τι έρχεται μετά;' : 'Ποιο είναι το επόμενο;',
    explanationNarration,
    difficulty,
    category: correctElement.semanticType,
    enabled: true,
    origin: 'SYSTEM',
  }
}

export const PATTERN_ASSETS = new Map<string, IllustratedAsset>([
  ['pattern-red', { symbol: '🔴', color: '#fff1f1', label: 'κόκκινο' }],
  ['pattern-blue', { symbol: '🔵', color: '#edf5ff', label: 'μπλε' }],
  ['pattern-yellow', { symbol: '🟡', color: '#fff9d8', label: 'κίτρινο' }],
  ['pattern-circle', { symbol: '●', color: '#eaf7ff', label: 'κύκλος' }],
  ['pattern-triangle', { symbol: '▲', color: '#fff1e6', label: 'τρίγωνο' }],
  ['pattern-square', { symbol: '■', color: '#f1edff', label: 'τετράγωνο' }],
  ['pattern-star', { symbol: '★', color: '#fff8d9', label: 'αστέρι' }],
  ['pattern-apple', { symbol: '🍎', color: '#fff0ed', label: 'μήλο' }],
  ['pattern-banana', { symbol: '🍌', color: '#fff8d9', label: 'μπανάνα' }],
  ['pattern-ball', { symbol: '⚽', color: '#eef7f4', label: 'μπάλα' }],
  ['pattern-flower', { symbol: '🌼', color: '#fff7e2', label: 'λουλούδι' }],
  ['pattern-fish', { symbol: '🐟', color: '#e8f7ff', label: 'ψάρι' }],
])

export const SYSTEM_PATTERNS: PatternDefinition[] = [
  pattern('pattern-abab-red-blue', 'ABAB', ['red', 'blue', 'red', 'blue', 'red'], 4, ['blue', 'yellow'], 1, 'Μπράβο! Μετά το μπλε έρχεται το κόκκινο.'),
  pattern('pattern-abab-circle-triangle', 'ABAB', ['circle', 'triangle', 'circle', 'triangle', 'circle'], 4, ['triangle', 'square'], 1, 'Μπράβο! Μετά το τρίγωνο έρχεται ο κύκλος.'),
  pattern('pattern-abab-apple-banana', 'ABAB', ['apple', 'banana', 'apple', 'banana', 'apple'], 4, ['banana', 'ball'], 1, 'Μπράβο! Μετά την μπανάνα έρχεται το μήλο.'),
  pattern('pattern-abab-ball-flower', 'ABAB', ['ball', 'flower', 'ball', 'flower', 'ball'], 4, ['flower', 'fish'], 1, 'Μπράβο! Μετά το λουλούδι έρχεται η μπάλα.'),
  pattern('pattern-abab-yellow-blue', 'ABAB', ['yellow', 'blue', 'yellow', 'blue', 'yellow'], 4, ['blue', 'red'], 1, 'Μπράβο! Μετά το μπλε έρχεται το κίτρινο.'),
  pattern('pattern-aabb-red-blue', 'AABB', ['red', 'red', 'blue', 'blue', 'red', 'red'], 5, ['blue', 'yellow'], 2, 'Μπράβο! Έρχονται δύο κόκκινα μαζί.'),
  pattern('pattern-aabb-square-star', 'AABB', ['square', 'square', 'star', 'star', 'square', 'square'], 5, ['star', 'triangle'], 2, 'Μπράβο! Έρχονται δύο τετράγωνα μαζί.'),
  pattern('pattern-aabb-fish-flower', 'AABB', ['fish', 'fish', 'flower', 'flower', 'fish', 'fish'], 5, ['flower', 'ball'], 2, 'Μπράβο! Έρχονται δύο ψάρια μαζί.'),
  pattern('pattern-abab-triangle-square', 'ABAB', ['triangle', 'square', 'triangle', 'square', 'triangle'], 4, ['square', 'circle'], 2, 'Μπράβο! Μετά το τετράγωνο έρχεται το τρίγωνο.'),
  pattern('pattern-abab-fish-apple', 'ABAB', ['fish', 'apple', 'fish', 'apple', 'fish'], 4, ['apple', 'banana'], 2, 'Μπράβο! Μετά το μήλο έρχεται το ψάρι.'),
  pattern('pattern-aab-circle-star', 'AAB', ['circle', 'circle', 'star', 'circle', 'circle', 'star'], 5, ['circle', 'square'], 3, 'Μπράβο! Δύο κύκλοι και μετά ένα αστέρι.'),
  pattern('pattern-abb-apple-banana', 'ABB', ['apple', 'banana', 'banana', 'apple', 'banana', 'banana'], 5, ['apple', 'fish'], 3, 'Μπράβο! Ένα μήλο και μετά δύο μπανάνες.'),
  pattern('pattern-block-red-yellow-blue', 'REPEATED_BLOCK', ['red', 'yellow', 'blue', 'red', 'yellow', 'blue'], 5, ['red', 'yellow'], 3, 'Μπράβο! Κόκκινο, κίτρινο και μετά μπλε.'),
]
