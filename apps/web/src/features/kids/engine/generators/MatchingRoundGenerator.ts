import { CARDS_BY_ID, SYSTEM_RELATIONSHIPS } from '../../content/system'
import { shuffled } from '../random'
import type { MatchingRound, RoundGenerationInput, RoundGenerator } from '../types'
import { distractorsFor, roundId } from './shared'
import { cardsForDeck } from './shared'

export class MatchingRoundGenerator implements RoundGenerator<MatchingRound> {
  generate(input: RoundGenerationInput): MatchingRound | null {
    const candidates = SYSTEM_RELATIONSHIPS.filter((relationship) => {
      const source = CARDS_BY_ID.get(relationship.sourceCardId)
      const target = CARDS_BY_ID.get(relationship.targetCardId)
      return source?.deckId === input.deckId || target?.deckId === input.deckId
    })
    const relationship = candidates[input.roundIndex % candidates.length]
    if (!relationship) return null
    const relationshipSource = CARDS_BY_ID.get(relationship.sourceCardId)
    const relationshipTarget = CARDS_BY_ID.get(relationship.targetCardId)
    if (!relationshipSource || !relationshipTarget) return null
    const reverseProfessionMatch = relationship.type === 'USES'
    const source = reverseProfessionMatch ? relationshipTarget : relationshipSource
    const target = reverseProfessionMatch ? relationshipSource : relationshipTarget
    const reverseTargets = new Set(
      SYSTEM_RELATIONSHIPS.filter((item) =>
        reverseProfessionMatch
          ? item.type === 'USES' && item.targetCardId === source.id
          : item.sourceCardId === source.id,
      ).map((item) => reverseProfessionMatch ? item.sourceCardId : item.targetCardId),
    )
    const optionCount = input.difficulty >= 3 ? 3 : 2
    const distractors = reverseProfessionMatch
      ? shuffled(
          cardsForDeck(input.deckId).filter(
            (card) =>
              card.category === 'PROFESSION' &&
              card.id !== source.id &&
              !reverseTargets.has(card.id),
          ),
          input.rng,
        ).slice(0, optionCount - 1)
      : distractorsFor(
          new Set([source.id, ...reverseTargets]),
          optionCount - 1,
          input.rng,
          target.deckId,
        )
    if (distractors.length !== optionCount - 1) return null
    return {
      id: roundId('matching', input.deckId, input.roundIndex),
      mode: 'MATCHING',
      difficulty: input.difficulty,
      deckId: input.deckId,
      instructionText: reverseProfessionMatch
        ? `Ποιος χρησιμοποιεί ${source.title};`
        : `Τι ταιριάζει με ${source.title};`,
      narrationText: reverseProfessionMatch
        ? `Ποιος χρησιμοποιεί ${source.title};`
        : `Τι ταιριάζει με ${source.title};`,
      skill: `RELATION_${relationship.type}`,
      contentIds: [source.id, target.id, ...distractors.map((card) => card.id)],
      sourceCardId: source.id,
      optionCardIds: shuffled([target.id, ...distractors.map((card) => card.id)], input.rng),
      correctCardId: target.id,
      relationshipId: relationship.id,
      ...(reverseProfessionMatch
        ? {
            conceptId: `tool:${source.id.replace('tool-', '')}`,
            conceptType: 'PROFESSION' as const,
          }
        : {}),
    }
  }
}
