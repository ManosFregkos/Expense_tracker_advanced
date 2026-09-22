import { useEffect, useRef, type RefObject } from 'react'
import { isTVVisible, mapTVKey, nextTVFocus } from './tv'

export function useTVNavigation(
  root: RefObject<HTMLDivElement | null>,
  onBack: () => void,
  dependency: unknown,
) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  useEffect(() => {
    const container = root.current
    if (!container) return
    const candidates = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-tv-focus]')).filter(isTVVisible)
    const primary = container.querySelector<HTMLElement>('[data-tv-primary]')
    const current = document.activeElement as HTMLElement | null
    const first = primary && isTVVisible(primary) ? primary : candidates()[0]
    if (first && (primary || !current || !container.contains(current) || !isTVVisible(current)))
      first.focus()
    const handle = (event: KeyboardEvent) => {
      const action = mapTVKey(event)
      if (!action) return
      if (action === 'back') {
        event.preventDefault()
        onBackRef.current()
        return
      }
      const target = document.activeElement as HTMLElement
      if (!container.contains(target)) {
        candidates()[0]?.focus()
        event.preventDefault()
        return
      }
      if (action === 'activate') return
      const next = nextTVFocus(target, candidates(), action)
      if (next) {
        event.preventDefault()
        next.focus()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [root, dependency])
}
