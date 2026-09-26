import {
  emotionScenarioSchema,
  everydayScenarioSchema,
  learningCardSchema,
  learningDeckSchema,
  learningRelationshipSchema,
  sequenceDefinitionSchema,
  type EmotionScenario,
  type EverydayScenario,
  type KidsCardGameMode,
  type KidsDeckCapabilities,
  type LearningCard,
  type LearningDeck,
  type LearningRelationship,
  type SequenceDefinition,
} from '@family-expense-tracker/shared'
import { collection, getDocs } from 'firebase/firestore'
import { firestore } from '../../../lib/firebase'
import {
  CARDS_BY_ID,
  DECKS_BY_ID,
  ALL_SYSTEM_RELATIONSHIPS,
  KIDS_ASSETS,
  SYSTEM_CARDS,
  SYSTEM_DECKS,
  SYSTEM_RELATIONSHIPS,
} from './system'
import {
  SYSTEM_EMOTION_SCENARIOS,
  SYSTEM_EVERYDAY_SCENARIOS,
  SYSTEM_SEQUENCES,
} from './system/advanced'

type ContentSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown }
}

const collections = {
  decks: 'kidsCustomDecks',
  cards: 'kidsCustomCards',
  relationships: 'kidsRelationships',
  everyday: 'kidsEverydayScenarios',
  sequences: 'kidsSequences',
  emotions: 'kidsEmotionScenarios',
} as const

async function validatedCollection<T>(
  householdId: string,
  name: string,
  schema: ContentSchema<T>,
): Promise<T[]> {
  const snapshot = await getDocs(collection(firestore, 'households/' + householdId + '/' + name))
  return snapshot.docs.flatMap((document) => {
    const parsed = schema.safeParse(document.data())
    if (parsed.success) return [parsed.data]
    console.error('Invalid Kids content skipped', { collection: name, id: document.id })
    return []
  })
}

export function getDeckCapabilities(
  deck: LearningDeck,
  cards: readonly LearningCard[],
  relationships: readonly LearningRelationship[],
): KidsDeckCapabilities {
  const deckCards = cards.filter(
    (card) => deck.cardIds.includes(card.id) && card.enabled && !card.archivedAt,
  )
  const categories = new Map<string, number>()
  for (const card of deckCards)
    categories.set(card.category, (categories.get(card.category) ?? 0) + 1)
  const hasRelationship = relationships.some(
    (item) =>
      item.enabled !== false &&
      !item.archivedAt &&
      (deck.cardIds.includes(item.sourceCardId) || deck.cardIds.includes(item.targetCardId)) &&
      cards.some((card) => card.id === item.sourceCardId) &&
      cards.some((card) => card.id === item.targetCardId),
  )
  const hasClassification = relationships.some(
    (item) =>
      item.enabled !== false &&
      !item.archivedAt &&
      ['BELONGS_IN', 'LIVES_IN', 'STORED_IN', 'USED_IN', 'PART_OF', 'WORN_ON'].includes(
        item.type,
      ) &&
      deck.cardIds.includes(item.sourceCardId),
  )
  const comparisonValues = deckCards.flatMap((card) => {
    if (card.attributes?.count !== undefined) return [`count:${card.attributes.count}`]
    if (card.attributes?.size) return [`size:${card.attributes.size}`]
    return []
  })
  const hasComparison = new Set(comparisonValues).size >= 2
  const oddOneOut =
    deck.origin === 'SYSTEM'
      ? deck.supportedModes.includes('ODD_ONE_OUT') && deckCards.length >= 3
      : deckCards.length >= 3 && categories.size >= 2
  const reasons: Partial<Record<KidsCardGameMode, string>> = {}
  const isEarlyLearning = deck.category === 'EARLY_MATH' || deck.category === 'FLAGS'
  if (deckCards.length < 4) reasons.MEMORY_PAIRS = 'Χρειάζονται τουλάχιστον 4 κάρτες.'
  if (!hasRelationship) reasons.MATCHING = 'Προσθέστε τουλάχιστον μία ρητή σχέση.'
  if (!hasComparison) reasons.COMPARE = 'Προσθέστε μεταδεδομένα σύγκρισης σε δύο κάρτες.'
  if (!hasClassification) reasons.CLASSIFY = 'Προσθέστε μια σχέση προορισμού.'
  if (!oddOneOut) reasons.ODD_ONE_OUT = 'Χρειάζονται αρκετές κάρτες σε διαφορετικές κατηγορίες.'
  return {
    learnAndChoose: !isEarlyLearning && deckCards.length >= 2,
    sameDifferent: deckCards.length >= 2,
    matching: hasRelationship,
    oddOneOut,
    compare: hasComparison,
    classify: hasClassification,
    memoryPairs: deckCards.length >= 4,
    reasons,
  }
}

export class KidsContentRepository {
  constructor(private readonly householdId: string) {}

  async getDecks(): Promise<LearningDeck[]> {
    const custom = await validatedCollection(
      this.householdId,
      collections.decks,
      learningDeckSchema as ContentSchema<LearningDeck>,
    )
    return [...SYSTEM_DECKS, ...custom.filter((item) => !item.archivedAt)]
  }

  async getCards(deckId?: string): Promise<LearningCard[]> {
    const custom = await validatedCollection(
      this.householdId,
      collections.cards,
      learningCardSchema as ContentSchema<LearningCard>,
    )
    return [...SYSTEM_CARDS, ...custom].filter(
      (item) => !item.archivedAt && (!deckId || item.deckId === deckId),
    )
  }

  async getRelationships(): Promise<LearningRelationship[]> {
    const custom = await validatedCollection(
      this.householdId,
      collections.relationships,
      learningRelationshipSchema as ContentSchema<LearningRelationship>,
    )
    return [...ALL_SYSTEM_RELATIONSHIPS, ...custom.filter((item) => !item.archivedAt)]
  }

  async getEverydayScenarios(): Promise<EverydayScenario[]> {
    const custom = await validatedCollection(
      this.householdId,
      collections.everyday,
      everydayScenarioSchema as ContentSchema<EverydayScenario>,
    )
    return [...SYSTEM_EVERYDAY_SCENARIOS, ...custom.filter((item) => !item.archivedAt)]
  }

  async getSequences(): Promise<SequenceDefinition[]> {
    const custom = await validatedCollection(
      this.householdId,
      collections.sequences,
      sequenceDefinitionSchema as ContentSchema<SequenceDefinition>,
    )
    return [...SYSTEM_SEQUENCES, ...custom.filter((item) => !item.archivedAt)]
  }

  async getEmotionScenarios(): Promise<EmotionScenario[]> {
    const custom = await validatedCollection(
      this.householdId,
      collections.emotions,
      emotionScenarioSchema as ContentSchema<EmotionScenario>,
    )
    return [...SYSTEM_EMOTION_SCENARIOS, ...custom.filter((item) => !item.archivedAt)]
  }

  async getDeck(id: string) {
    return (await this.getDecks()).find((deck) => deck.id === id) ?? null
  }

  async getSupportedModes(deckId: string): Promise<KidsCardGameMode[]> {
    const [decks, cards, relationships] = await Promise.all([
      this.getDecks(),
      this.getCards(),
      this.getRelationships(),
    ])
    const deck = decks.find((item) => item.id === deckId)
    if (!deck) return []
    if (deck.category === 'EARLY_MATH' || deck.category === 'FLAGS') return deck.supportedModes
    const capabilities = getDeckCapabilities(deck, cards, relationships)
    return [
      capabilities.learnAndChoose && 'LEARN_AND_CHOOSE',
      capabilities.sameDifferent && 'SAME_OR_DIFFERENT',
      capabilities.matching && 'MATCHING',
      capabilities.oddOneOut && 'ODD_ONE_OUT',
      capabilities.compare && 'COMPARE',
      capabilities.classify && 'CLASSIFY',
      capabilities.memoryPairs && 'MEMORY_PAIRS',
    ].filter((mode): mode is KidsCardGameMode => Boolean(mode))
  }
}

export async function installHouseholdContent(householdId: string) {
  const repository = new KidsContentRepository(householdId)
  const [decks, cards, relationships, everyday, sequences, emotions] = await Promise.all([
    repository.getDecks(),
    repository.getCards(),
    repository.getRelationships(),
    repository.getEverydayScenarios(),
    repository.getSequences(),
    repository.getEmotionScenarios(),
  ])
  for (const deck of decks.filter((item) => item.origin === 'CUSTOM')) {
    DECKS_BY_ID.set(deck.id, deck)
    if (!SYSTEM_DECKS.some((item) => item.id === deck.id)) SYSTEM_DECKS.push(deck)
  }
  for (const card of cards.filter((item) => item.origin === 'CUSTOM')) {
    CARDS_BY_ID.set(card.id, card)
    if (!SYSTEM_CARDS.some((item) => item.id === card.id)) SYSTEM_CARDS.push(card)
    KIDS_ASSETS.set(card.assetId, {
      symbol: '🖼️',
      color: '#eef2f5',
      ...(card.assetUrl ? { url: card.assetUrl } : {}),
    })
  }
  for (const relationship of relationships.filter((item) => item.origin === 'CUSTOM')) {
    if (!SYSTEM_RELATIONSHIPS.some((item) => item.id === relationship.id))
      SYSTEM_RELATIONSHIPS.push(relationship)
  }
  for (const item of everyday.filter((value) => value.origin === 'CUSTOM')) {
    if (!SYSTEM_EVERYDAY_SCENARIOS.some((value) => value.id === item.id))
      SYSTEM_EVERYDAY_SCENARIOS.push(item)
  }
  for (const item of sequences.filter((value) => value.origin === 'CUSTOM')) {
    if (!SYSTEM_SEQUENCES.some((value) => value.id === item.id)) SYSTEM_SEQUENCES.push(item)
  }
  for (const item of emotions.filter((value) => value.origin === 'CUSTOM')) {
    if (!SYSTEM_EMOTION_SCENARIOS.some((value) => value.id === item.id))
      SYSTEM_EMOTION_SCENARIOS.push(item)
  }
  return { decks, cards, relationships, everyday, sequences, emotions }
}
