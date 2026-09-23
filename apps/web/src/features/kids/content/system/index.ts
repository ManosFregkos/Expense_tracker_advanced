import type {
  LearningCard,
  LearningDeck,
  LearningRelationship,
} from '@family-expense-tracker/shared'
import { animals } from './decks/animals'
import { body } from './decks/body'
import { clothes } from './decks/clothes'
import { colors } from './decks/colors'
import { food } from './decks/food'
import { fruits } from './decks/fruits'
import { household } from './decks/household'
import { instruments } from './decks/instruments'
import { nature } from './decks/nature'
import { seaAnimals } from './decks/seaAnimals'
import { shapes } from './decks/shapes'
import { space } from './decks/space'
import { createSystemDeck } from './types'
import {
  ADVANCED_ASSETS,
  CLASSIFICATION_DESTINATIONS,
  EMOTION_ASSETS,
  SYSTEM_CLASSIFICATION_RELATIONSHIPS,
  type IllustratedAsset,
} from './advanced'

const seeds = [
  animals,
  seaAnimals,
  fruits,
  food,
  shapes,
  colors,
  household,
  nature,
  space,
  instruments,
  body,
  clothes,
]
const content = seeds.map(createSystemDeck)

const advancedDecks: LearningDeck[] = [
  {
    id: 'everyday',
    title: 'Καθημερινά',
    description: 'Απλές καθημερινές επιλογές',
    category: 'EVERYDAY',
    supportedModes: ['EVERYDAY_CHOICE'],
    cardIds: ['hands-before-food', 'road-hand'],
    enabled: true,
    origin: 'SYSTEM',
    contentVersion: 2,
  },
  {
    id: 'sequences',
    title: 'Τι έρχεται μετά;',
    description: 'Απλές σειρές τριών βημάτων',
    category: 'SEQUENCE',
    supportedModes: ['SEQUENCE'],
    cardIds: ['seed-flower', 'egg-bird'],
    enabled: true,
    origin: 'SYSTEM',
    contentVersion: 2,
  },
  {
    id: 'emotions',
    title: 'Συναισθήματα',
    description: 'Καθαρά εικονογραφημένα συναισθήματα',
    category: 'EMOTION',
    supportedModes: ['EMOTION'],
    cardIds: ['gift-happy', 'icecream-sad'],
    enabled: true,
    origin: 'SYSTEM',
    contentVersion: 2,
  },
]

export const SYSTEM_DECKS: LearningDeck[] = [
  ...content.map((item) => ({
    ...item.deck,
    supportedModes: SYSTEM_CLASSIFICATION_RELATIONSHIPS.some((relationship) =>
      item.deck.cardIds.includes(relationship.sourceCardId),
    )
      ? [...new Set([...item.deck.supportedModes, 'CLASSIFY' as const])]
      : item.deck.supportedModes,
  })),
  ...advancedDecks,
]
export const SYSTEM_CARDS: LearningCard[] = content.flatMap((item) => item.cards)
export const CARDS_BY_ID = new Map(SYSTEM_CARDS.map((card) => [card.id, card]))
export const DECKS_BY_ID = new Map(SYSTEM_DECKS.map((deck) => [deck.id, deck]))

export const KIDS_ASSETS = new Map<string, IllustratedAsset>(
  seeds.flatMap((deck) =>
    deck.cards.map((card) => [card.id, { symbol: card.symbol, color: deck.color }] as const),
  ),
)
for (const [id, value] of [...ADVANCED_ASSETS, ...EMOTION_ASSETS, ...CLASSIFICATION_DESTINATIONS]) {
  KIDS_ASSETS.set(id, value)
}
KIDS_ASSETS.set('hands-before-food', { symbol: '🧼', color: '#e5f7ff' })
KIDS_ASSETS.set('seed-flower', { symbol: '🌱', color: '#e3f6df' })
KIDS_ASSETS.set('gift-happy', { symbol: '🙂', color: '#fff2d9' })

export const SYSTEM_RELATIONSHIPS: LearningRelationship[] = [
  {
    id: 'rain-umbrella',
    sourceCardId: 'rain',
    targetCardId: 'umbrella',
    type: 'USED_WITH',
    narration: 'Η ομπρέλα ταιριάζει με τη βροχή.',
  },
  {
    id: 'bee-honey',
    sourceCardId: 'bee',
    targetCardId: 'honey',
    type: 'PRODUCES',
    narration: 'Η μέλισσα φτιάχνει μέλι.',
  },
  {
    id: 'toothbrush-teeth',
    sourceCardId: 'toothbrush',
    targetCardId: 'teeth',
    type: 'USED_WITH',
    narration: 'Η οδοντόβουρτσα ταιριάζει με τα δόντια.',
  },
  {
    id: 'shoe-foot',
    sourceCardId: 'shoe',
    targetCardId: 'foot',
    type: 'WEARS',
    narration: 'Το παπούτσι μπαίνει στο πόδι.',
  },
  {
    id: 'cow-milk',
    sourceCardId: 'cow',
    targetCardId: 'milk',
    type: 'PRODUCES',
    narration: 'Η αγελάδα μας δίνει γάλα.',
  },
  {
    id: 'fish-water',
    sourceCardId: 'fish',
    targetCardId: 'water',
    type: 'LIVES_IN',
    narration: 'Το ψάρι ζει στο νερό.',
  },
  {
    id: 'spoon-bowl',
    sourceCardId: 'spoon',
    targetCardId: 'bowl',
    type: 'USED_WITH',
    narration: 'Το κουτάλι ταιριάζει με το μπολ.',
  },
]

export const ALL_SYSTEM_RELATIONSHIPS = [
  ...SYSTEM_RELATIONSHIPS,
  ...SYSTEM_CLASSIFICATION_RELATIONSHIPS,
]

export function getSupportedModes(deck: LearningDeck) {
  return deck.supportedModes.filter((mode) => {
    if (mode === 'MATCHING')
      return SYSTEM_RELATIONSHIPS.some(
        (relationship) =>
          deck.cardIds.includes(relationship.sourceCardId) ||
          deck.cardIds.includes(relationship.targetCardId),
      )
    if (mode === 'CLASSIFY')
      return [...SYSTEM_CLASSIFICATION_RELATIONSHIPS, ...SYSTEM_RELATIONSHIPS].some(
        (relationship) =>
          ['BELONGS_IN', 'LIVES_IN', 'STORED_IN', 'USED_IN', 'PART_OF', 'WORN_ON'].includes(
            relationship.type,
          ) && deck.cardIds.includes(relationship.sourceCardId),
      )
    if (mode === 'MEMORY_PAIRS') return deck.cardIds.length >= 4
    if (mode === 'COMPARE' && deck.origin === 'CUSTOM') {
      const values = deck.cardIds
        .map((id) => CARDS_BY_ID.get(id))
        .flatMap((card) => {
          if (!card?.enabled) return []
          if (card.attributes?.count !== undefined) return [`count:${card.attributes.count}`]
          if (card.attributes?.size) return [`size:${card.attributes.size}`]
          return []
        })
      return new Set(values).size >= 2
    }
    if (mode === 'EVERYDAY_CHOICE' || mode === 'SEQUENCE' || mode === 'EMOTION') return true
    return deck.cardIds.length >= (mode === 'ODD_ONE_OUT' ? 3 : 2)
  })
}
