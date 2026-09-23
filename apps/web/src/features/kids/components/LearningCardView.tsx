import type { LearningCard } from '@family-expense-tracker/shared'
import { KIDS_ASSETS } from '../content/system'
import { useTVFocusable } from './TVFocusProvider'

export function LearningCardView({
  card,
  onActivate,
  selected = false,
  correct = false,
  hint = false,
  disabled = false,
  interactive = true,
  autofocus = false,
}: {
  card: LearningCard
  onActivate?: () => void
  selected?: boolean
  correct?: boolean
  hint?: boolean
  disabled?: boolean
  interactive?: boolean
  autofocus?: boolean
}) {
  const focusable = useTVFocusable()
  const asset = KIDS_ASSETS.get(card.assetId)
  const state = correct ? 'correct' : hint ? 'hint' : selected ? 'selected' : 'idle'
  if (!interactive) {
    return (
      <div
        className="learning-card"
        data-state={state}
        aria-label={card.title}
        style={{ '--card-color': asset?.color ?? '#eef2f5' } as React.CSSProperties}
      >
        <span className="learning-card-symbol" aria-hidden="true">
          {asset?.symbol ?? '⭐'}
        </span>
        <span className="learning-card-title">{card.title}</span>
      </div>
    )
  }
  return (
    <button
      type="button"
      className="learning-card"
      data-state={state}
      data-tv-autofocus={autofocus ? 'true' : undefined}
      style={{ '--card-color': asset?.color ?? '#eef2f5' } as React.CSSProperties}
      disabled={disabled}
      onClick={onActivate}
      aria-label={card.narration}
      {...focusable}
    >
      <span className="learning-card-symbol" aria-hidden="true">
        {asset?.symbol ?? '⭐'}
      </span>
      <span className="learning-card-title">{card.title}</span>
    </button>
  )
}
