import type { SpatialConceptRound } from '../engine/types'
import { AssetChoiceCard } from './AssetChoiceCard'
import { TVCardGrid } from './TVCardGrid'

export function SpatialRoundView({
  round,
  disabled,
  selected,
  feedback,
  showHint,
  onAnswer,
}: {
  round: SpatialConceptRound
  disabled: boolean
  selected?: string
  feedback: boolean
  showHint: boolean
  onAnswer: (id: string) => void
}) {
  return (
    <TVCardGrid>
      {round.options.map((option, index) => (
        <AssetChoiceCard
          key={option.id}
          assetId={option.assetId}
          label={option.narration ?? 'εικόνα θέσης'}
          autofocus={index === 0}
          disabled={disabled}
          selected={selected === option.id}
          correct={feedback && selected === option.id && option.id === round.correctChoiceId}
          hint={showHint && option.id === round.correctChoiceId}
          onActivate={() => onAnswer(option.id)}
        />
      ))}
    </TVCardGrid>
  )
}
