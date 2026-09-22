import type { CSSProperties, ReactNode } from 'react'
import { assets } from './content'

export const labels = {
  hub: 'Παιχνίδια',
  explorer: 'Μικρός Εξερευνητής',
  memory: 'Τι Λείπει;',
  logic: 'Και Μετά Τι;',
  again: 'Άλλο ένα;',
  back: 'Πίσω',
  repeat: 'Άκου ξανά',
  bravo: 'Μπράβο!',
  retry: 'Δοκίμασε ξανά!',
  finish: 'Μπράβο! Τελειώσαμε το παιχνίδι!',
  look: 'Κοίταξε καλά!',
  parent: 'Για γονείς',
}
export const avatarGlyph: Record<string, string> = {
  star: '⭐',
  moon: '🌙',
  sun: '☀️',
  flower: '🌼',
}

export function TVButton({
  children,
  onClick,
  className = '',
  disabled = false,
  ariaLabel,
  style,
  primary = false,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
  disabled?: boolean
  ariaLabel?: string
  style?: CSSProperties
  primary?: boolean
}) {
  return (
    <button
      type="button"
      data-tv-focus
      data-tv-primary={primary ? '' : undefined}
      className={`kids-button ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </button>
  )
}
export function Asset({ id }: { id: string }) {
  const asset = assets[id]
  return (
    <span
      className="kids-asset"
      role="img"
      aria-label={asset?.label ?? id}
      style={{ background: asset?.color ?? '#ddd' }}
    >
      {asset?.glyph ?? '✨'}
    </span>
  )
}
