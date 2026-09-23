import { IconVolume } from '@tabler/icons-react'
import { kidsStrings } from '../i18n'
import { useTVFocusable } from './TVFocusProvider'

export function RepeatNarrationButton({
  onRepeat,
  autofocus = false,
}: {
  onRepeat: () => void
  autofocus?: boolean
}) {
  const focusable = useTVFocusable()
  return (
    <button
      type="button"
      className="kids-repeat"
      onClick={onRepeat}
      aria-label={kidsStrings.repeat}
      data-tv-autofocus={autofocus ? 'true' : undefined}
      {...focusable}
    >
      <IconVolume aria-hidden="true" />
    </button>
  )
}
