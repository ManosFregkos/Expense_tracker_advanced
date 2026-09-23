import type { KidsCardGameMode, LearningCard, LearningDeck } from '@family-expense-tracker/shared'

export interface SystemCardSeed {
  id: string
  title: string
  symbol: string
  narration?: string
  tags?: string[]
  attributes?: LearningCard['attributes']
  difficulty?: LearningCard['difficulty']
}

export interface SystemDeckSeed {
  id: string
  title: string
  description: string
  category: string
  color: string
  modes: KidsCardGameMode[]
  cards: SystemCardSeed[]
}

export interface SystemDeckContent {
  deck: LearningDeck
  cards: LearningCard[]
}

export function createSystemDeck(seed: SystemDeckSeed): SystemDeckContent {
  const cards: LearningCard[] = seed.cards.map((card) => ({
    id: card.id,
    deckId: seed.id,
    title: card.title,
    narration: card.narration ?? `Να ${card.title}.`,
    assetId: card.id,
    category: seed.category,
    tags: card.tags ?? [],
    ...(card.attributes ? { attributes: card.attributes } : {}),
    difficulty: card.difficulty ?? 1,
    enabled: true,
    origin: 'SYSTEM',
    contentVersion: 2,
  }))
  return {
    deck: {
      id: seed.id,
      title: seed.title,
      description: seed.description,
      narrationTitle: seed.title,
      category: seed.category,
      ageBand: '3-5',
      supportedModes: [...new Set([...seed.modes, 'MEMORY_PAIRS' as const])],
      cardIds: cards.map((card) => card.id),
      enabled: true,
      origin: 'SYSTEM',
      contentVersion: 2,
    },
    cards,
  }
}
