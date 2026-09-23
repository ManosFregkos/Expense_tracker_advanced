import { CARDS_BY_ID, SYSTEM_RELATIONSHIPS } from '../../content/system'
import { shuffled } from '../random'
import type { MatchingRound, RoundGenerationInput, RoundGenerator } from '../types'
import { distractorsFor, roundId } from './shared'

export class MatchingRoundGenerator implements RoundGenerator<MatchingRound> {
  generate(input: RoundGenerationInput): MatchingRound | null {
    const candidates = SYSTEM_RELATIONSHIPS.filter((relationship) => {
      const source = CARDS_BY_ID.get(relationship.sourceCardId)
      const target = CARDS_BY_ID.get(relationship.targetCardId)
      return source?.deckId === input.deckId || target?.deckId === input.deckId
    })
    const relationship = candidates[input.roundIndex % candidates.length]
    if (!relationship) return null
    const source = CARDS_BY_ID.get(relationship.sourceCardId)
    const target = CARDS_BY_ID.get(relationship.targetCardId)
    if (!source || !target) return null
    const reverseTargets = new Set(
      SYSTEM_RELATIONSHIPS.filter((item) => item.sourceCardId === source.id).map(
        (item) => item.targetCardId,
      ),
    )
    const optionCount = input.difficulty >= 3 ? 3 : 2
    const distractors = distractorsFor(
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
      instructionText: `Τι ταιριάζει με ${source.title};`,
      narrationText: `Τι ταιριάζει με ${source.title};`,
      skill: `RELATION_${relationship.type}`,
      contentIds: [source.id, target.id, ...distractors.map((card) => card.id)],
      sourceCardId: source.id,
      optionCardIds: shuffled([target.id, ...distractors.map((card) => card.id)], input.rng),
      correctCardId: target.id,
      relationshipId: relationship.id,
    }
  }
}
