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

export const SYSTEM_DECKS: LearningDeck[] = content.map((item) => item.deck)
export const SYSTEM_CARDS: LearningCard[] = content.flatMap((item) => item.cards)
export const CARDS_BY_ID = new Map(SYSTEM_CARDS.map((card) => [card.id, card]))
export const DECKS_BY_ID = new Map(SYSTEM_DECKS.map((deck) => [deck.id, deck]))

export const KIDS_ASSETS = new Map(
  seeds.flatMap((deck) =>
    deck.cards.map((card) => [card.id, { symbol: card.symbol, color: deck.color }] as const),
  ),
)

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

export function getSupportedModes(deck: LearningDeck) {
  return deck.supportedModes.filter((mode) => {
    if (mode === 'MATCHING')
      return SYSTEM_RELATIONSHIPS.some(
        (relationship) =>
          deck.cardIds.includes(relationship.sourceCardId) ||
          deck.cardIds.includes(relationship.targetCardId),
      )
    return deck.cardIds.length >= (mode === 'ODD_ONE_OUT' ? 3 : 2)
  })
}
