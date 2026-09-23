import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react'

interface TVFocusContextValue {
  focusableProps: { 'data-tv-focusable': string }
}

const TVFocusContext = createContext<TVFocusContextValue>({
  focusableProps: { 'data-tv-focusable': 'true' },
})

function visibleButtons(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-tv-focusable="true"]')].filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0,
  )
}

function moveFocus(root: HTMLElement, key: string) {
  const elements = visibleButtons(root)
  if (!elements.length) return
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const current = active && elements.includes(active) ? active : null
  if (!current) {
    ;(root.querySelector<HTMLElement>('[data-tv-autofocus="true"]') ?? elements[0])?.focus()
    return
  }
  const from = current.getBoundingClientRect()
  const fromX = from.left + from.width / 2
  const fromY = from.top + from.height / 2
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight'
  const direction = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
  const candidates = elements
    .filter((element) => element !== current)
    .map((element) => {
      const rect = element.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const primary = horizontal ? (x - fromX) * direction : (y - fromY) * direction
      const secondary = horizontal ? Math.abs(y - fromY) : Math.abs(x - fromX)
      return { element, primary, score: primary + secondary * 2.5 }
    })
    .filter((candidate) => candidate.primary > 4)
    .sort((left, right) => left.score - right.score)
  candidates[0]?.element.focus()
}

export function TVFocusProvider({
  children,
  focusKey,
  onBack,
}: {
  children: ReactNode
  focusKey?: string | number
  onBack?: () => void
}) {
  const value = useMemo<TVFocusContextValue>(
    () => ({ focusableProps: { 'data-tv-focusable': 'true' } }),
    [],
  )
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-tv-focus-root="true"]')
    if (!root) return
    const buttons = visibleButtons(root)
    const autofocus = buttons.find((element) => element.dataset.tvAutofocus === 'true')
    ;(autofocus ?? buttons[0])?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        moveFocus(root, event.key)
      } else if (
        (event.key === 'Escape' || event.key === 'BrowserBack' || event.key === 'GoBack') &&
        onBack
      ) {
        event.preventDefault()
        onBack()
      }
    }
    const resetFocus = () => {
      requestAnimationFrame(() => {
        const buttons = visibleButtons(root)
        const autofocus = buttons.find((element) => element.dataset.tvAutofocus === 'true')
        ;(autofocus ?? buttons[0])?.focus()
      })
    }
    root.addEventListener('keydown', onKeyDown)
    window.addEventListener('kids:focus-reset', resetFocus)
    return () => {
      root.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('kids:focus-reset', resetFocus)
    }
  }, [focusKey, onBack])
  return <TVFocusContext.Provider value={value}>{children}</TVFocusContext.Provider>
}

export function useTVFocusable() {
  return useContext(TVFocusContext).focusableProps
}
