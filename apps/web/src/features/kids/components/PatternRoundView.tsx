import type { PatternCompleteRound } from '../engine/types'
import { KIDS_ASSETS } from '../content/system'
import { AssetChoiceCard } from './AssetChoiceCard'
import { TVCardGrid } from './TVCardGrid'

export function PatternRoundView({
  round,
  disabled,
  selected,
  feedback,
  showHint,
  onAnswer,
}: {
  round: PatternCompleteRound
  disabled: boolean
  selected?: string
  feedback: boolean
  showHint: boolean
  onAnswer: (id: string) => void
}) {
  return (
    <>
      <div className="kids-pattern" aria-label={round.narrationText}>
        {round.slots.map((slot, index) => {
          const asset = KIDS_ASSETS.get(slot.assetId)
          return (
            <div className="kids-pattern-slot" data-missing={slot.missing} key={`${slot.id}-${index}`}>
              {slot.missing ? (
                <span aria-label="λείπει">?</span>
              ) : asset?.url ? (
                <img src={asset.url} alt="" />
              ) : (
                <span aria-hidden="true">{asset?.symbol ?? '⭐'}</span>
              )}
            </div>
          )
        })}
      </div>
      <TVCardGrid>
        {round.options.map((option, index) => (
          <AssetChoiceCard
            key={option.id}
            assetId={option.assetId}
            label={option.narration ?? option.value}
            autofocus={index === 0}
            disabled={disabled}
            selected={selected === option.id}
            correct={feedback && selected === option.id && option.id === round.correctElementId}
            hint={showHint && option.id === round.correctElementId}
            onActivate={() => onAnswer(option.id)}
          />
        ))}
      </TVCardGrid>
    </>
  )
}
