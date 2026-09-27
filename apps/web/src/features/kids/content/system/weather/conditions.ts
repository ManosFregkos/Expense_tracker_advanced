import type { LearningCard } from '@family-expense-tracker/shared'
import type { IllustratedAsset } from '../advanced'

const conditions = [
  ['rain', 'βροχή', '🌧️', 'Αυτή είναι η βροχή.'],
  ['sun', 'ήλιος', '☀️', 'Αυτός είναι ο ήλιος.'],
  ['cold', 'κρύο', '🥶', 'Εδώ κάνει κρύο.'],
  ['snow', 'χιόνι', '🌨️', 'Αυτό είναι το χιόνι.'],
  ['wind', 'αέρας', '💨', 'Αυτός είναι ο αέρας.'],
] as const

export const WEATHER_CONDITION_CARDS: LearningCard[] = conditions.map(
  ([condition, title, , narration]) => ({
    id: `weather-condition-${condition}`,
    deckId: 'weather',
    title,
    narration,
    assetId: `weather-condition-${condition}`,
    category: 'WEATHER_CONDITION',
    subcategory: condition.toUpperCase(),
    tags: ['weather', condition],
    difficulty: 1,
    enabled: true,
    origin: 'SYSTEM',
    contentVersion: 4,
  }),
)

export const WEATHER_CONDITION_ASSETS = new Map<string, IllustratedAsset>(
  conditions.map(([condition, , symbol, narration]) => [
    `weather-condition-${condition}`,
    { symbol, color: condition === 'sun' ? '#fff8d9' : '#eaf7ff', label: narration },
  ]),
)
