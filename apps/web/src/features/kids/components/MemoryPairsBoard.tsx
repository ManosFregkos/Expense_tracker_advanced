import { useEffect, useRef, useState } from 'react'
import type { MemoryPairsRound } from '../engine/types'
import { CARDS_BY_ID, KIDS_ASSETS } from '../content/system'
import { useTVFocusable } from './TVFocusProvider'

type MemoryState =
  | 'READY_FOR_FIRST'
  | 'FIRST_REVEALED'
  | 'READY_FOR_SECOND'
  | 'COMPARING'
  | 'MATCHED_FEEDBACK'
  | 'RESETTING'
  | 'COMPLETE'

export function MemoryPairsBoard({
  round,
  onComplete,
}: {
  round: MemoryPairsRound
  onComplete: () => void
}) {
  const focusable = useTVFocusable()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<MemoryState>('READY_FOR_FIRST')
  const stateRef = useRef<MemoryState>('READY_FOR_FIRST')
  const [firstId, setFirstId] = useState<string>()
  const [secondId, setSecondId] = useState<string>()
  const [matched, setMatched] = useState<Set<string>>(() => new Set())

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const flip = (instanceId: string) => {
    const phase = stateRef.current
    if (
      matched.has(instanceId) ||
      phase === 'COMPARING' ||
      phase === 'RESETTING' ||
      phase === 'COMPLETE'
    )
      return
    if (phase === 'READY_FOR_FIRST') {
      setFirstId(instanceId)
      stateRef.current = 'FIRST_REVEALED'
      setState('FIRST_REVEALED')
      requestAnimationFrame(() => {
        stateRef.current = 'READY_FOR_SECOND'
        setState('READY_FOR_SECOND')
      })
      return
    }
    if (phase !== 'READY_FOR_SECOND' || instanceId === firstId) return
    setSecondId(instanceId)
    stateRef.current = 'COMPARING'
    setState('COMPARING')
    const first = round.cards.find((card) => card.instanceId === firstId)
    const second = round.cards.find((card) => card.instanceId === instanceId)
    const isMatch = Boolean(first && second && first.pairId === second.pairId)
    timer.current = setTimeout(
      () => {
        if (isMatch && firstId) {
          const next = new Set(matched)
          next.add(firstId)
          next.add(instanceId)
          setMatched(next)
          stateRef.current = 'MATCHED_FEEDBACK'
          setState('MATCHED_FEEDBACK')
          if (next.size === round.cards.length) {
            stateRef.current = 'COMPLETE'
            setState('COMPLETE')
            onComplete()
            return
          }
        } else {
          stateRef.current = 'RESETTING'
          setState('RESETTING')
        }
        setFirstId(undefined)
        setSecondId(undefined)
        requestAnimationFrame(() => {
          stateRef.current = 'READY_FOR_FIRST'
          setState('READY_FOR_FIRST')
          window.dispatchEvent(new Event('kids:focus-reset'))
        })
      },
      isMatch ? 650 : 1050,
    )
  }

  return (
    <div className="memory-grid" data-count={round.cards.length} data-memory-state={state}>
      {round.cards.map((item, index) => {
        const revealed =
          item.instanceId === firstId ||
          item.instanceId === secondId ||
          matched.has(item.instanceId)
        const card = CARDS_BY_ID.get(item.cardId)
        const asset = card ? KIDS_ASSETS.get(card.assetId) : undefined
        const completed = matched.has(item.instanceId)
        return (
          <button
            type="button"
            key={item.instanceId}
            className="memory-card"
            data-revealed={revealed}
            data-matched={completed}
            autoFocus={index === 0}
            data-tv-autofocus={index === 0 ? 'true' : undefined}
            disabled={
              completed || state === 'COMPARING' || state === 'RESETTING' || state === 'COMPLETE'
            }
            onClick={() => flip(item.instanceId)}
            aria-label={revealed ? (card?.title ?? 'Κάρτα') : 'Κρυφή κάρτα'}
            {...focusable}
          >
            <span aria-hidden="true">{revealed ? (asset?.symbol ?? '⭐') : '❓'}</span>
            {revealed ? <small>{card?.title}</small> : null}
          </button>
        )
      })}
    </div>
  )
}
