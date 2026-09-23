import { KIDS_ASSETS } from '../content/system'
import { useTVFocusable } from './TVFocusProvider'

export function AssetChoiceCard({
  assetId,
  label,
  onActivate,
  autofocus = false,
  disabled = false,
  selected = false,
  correct = false,
  hint = false,
}: {
  assetId: string
  label: string
  onActivate?: () => void
  autofocus?: boolean
  disabled?: boolean
  selected?: boolean
  correct?: boolean
  hint?: boolean
}) {
  const focusable = useTVFocusable()
  const asset = KIDS_ASSETS.get(assetId)
  const state = correct ? 'correct' : hint ? 'hint' : selected ? 'selected' : 'idle'
  return (
    <button
      type="button"
      className="learning-card"
      data-state={state}
      autoFocus={autofocus}
      data-tv-autofocus={autofocus ? 'true' : undefined}
      style={{ '--card-color': asset?.color ?? '#eef2f5' } as React.CSSProperties}
      disabled={disabled}
      onClick={onActivate}
      aria-label={label}
      {...focusable}
    >
      <span className="learning-card-symbol" aria-hidden="true">
        {asset?.symbol ?? '⭐'}
      </span>
      <span className="learning-card-title">{label}</span>
    </button>
  )
}
