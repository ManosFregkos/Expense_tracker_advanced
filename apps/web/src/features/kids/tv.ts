export type TVAction = 'up' | 'down' | 'left' | 'right' | 'activate' | 'back' | null
export function mapTVKey(event: KeyboardEvent): TVAction {
  const keys: Record<string, TVAction> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'activate',
    Escape: 'back',
    Backspace: 'back',
    BrowserBack: 'back',
  }
  return (
    keys[event.key] ??
    ({ 10009: 'back', 461: 'back' } as Record<number, TVAction>)[event.keyCode] ??
    null
  )
}
export function nextTVFocus(
  current: HTMLElement,
  candidates: HTMLElement[],
  direction: 'up' | 'down' | 'left' | 'right',
): HTMLElement | null {
  const origin = current.getBoundingClientRect()
  const cx = origin.left + origin.width / 2,
    cy = origin.top + origin.height / 2
  return (
    candidates
      .filter((item) => item !== current && isTVVisible(item))
      .map((item) => {
        const box = item.getBoundingClientRect()
        const dx = box.left + box.width / 2 - cx,
          dy = box.top + box.height / 2 - cy
        const primary =
          direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy
        const cross = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
        return { item, primary, score: primary + cross * 1.8 }
      })
      .filter((entry) => entry.primary > 2)
      .sort((a, b) => a.score - b.score)[0]?.item ?? null
  )
}
export function isTVVisible(item: HTMLElement): boolean {
  if (
    !item.getClientRects().length ||
    item.hasAttribute('disabled') ||
    item.closest('[aria-hidden="true"]')
  )
    return false
  const style = window.getComputedStyle(item)
  return (
    style.visibility !== 'hidden' &&
    style.visibility !== 'collapse' &&
    style.display !== 'none' &&
    (style.opacity === '' || Number(style.opacity) > 0)
  )
}
