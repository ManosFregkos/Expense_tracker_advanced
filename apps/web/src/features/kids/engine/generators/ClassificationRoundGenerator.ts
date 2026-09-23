import { CARDS_BY_ID, SYSTEM_RELATIONSHIPS } from '../../content/system'
import {
  CLASSIFICATION_DESTINATIONS,
  SYSTEM_CLASSIFICATION_RELATIONSHIPS,
} from '../../content/system/advanced'
import { sample, shuffled } from '../random'
import type { ClassificationRound, RoundGenerationInput, RoundGenerator } from '../types'
import { roundId } from './shared'

export class ClassificationRoundGenerator implements RoundGenerator<ClassificationRound> {
  generate(input: RoundGenerationInput): ClassificationRound | null {
    const classificationTypes = new Set([
      'BELONGS_IN',
      'LIVES_IN',
      'STORED_IN',
      'USED_IN',
      'PART_OF',
      'WORN_ON',
    ])
    const allRelationships = [
      ...SYSTEM_CLASSIFICATION_RELATIONSHIPS,
      ...SYSTEM_RELATIONSHIPS.filter((item) => classificationTypes.has(item.type)),
    ]
    const candidates = allRelationships.filter(
      (relationship) => CARDS_BY_ID.get(relationship.sourceCardId)?.deckId === input.deckId,
    )
    const relationship = candidates[input.roundIndex % candidates.length]
    if (!relationship || !CARDS_BY_ID.has(relationship.sourceCardId)) return null
    const validDestinations = new Set(
      allRelationships
        .filter((item) => item.sourceCardId === relationship.sourceCardId)
        .map((item) => item.targetCardId),
    )
    const optionCount = input.difficulty >= 2 ? 3 : 2
    const distractors = sample(
      [...CLASSIFICATION_DESTINATIONS.keys()].filter((id) => !validDestinations.has(id)),
      optionCount - 1,
      input.rng,
    )
    if (distractors.length !== optionCount - 1) return null
    return {
      id: roundId('classify', input.deckId, input.roundIndex),
      mode: 'CLASSIFY',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: 'Πού ανήκει;',
      narrationText: 'Πού ανήκει ' + CARDS_BY_ID.get(relationship.sourceCardId)?.title + ';',
      skill: 'CLASSIFICATION',
      contentIds: [relationship.sourceCardId, relationship.targetCardId, ...distractors],
      sourceCardId: relationship.sourceCardId,
      destinationIds: shuffled([relationship.targetCardId, ...distractors], input.rng),
      correctDestinationId: relationship.targetCardId,
      relationshipId: relationship.id,
      explanationNarration: relationship.narration ?? 'Αυτή είναι η σωστή θέση.',
    }
  }
}
