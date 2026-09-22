import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useHousehold } from '../households/HouseholdProvider'
import { worlds, type LogicScenario } from './content'
import {
  generateExplorerRounds,
  generateLogicRounds,
  generateMemoryRound,
  seededRandom,
  type GameType,
} from './engine'
import {
  enqueueKidsWrite,
  flushKidsWrites,
  listChildren,
  listCustomLogic,
  listProgress,
  type KidsProgress,
} from './api'
import { narration } from './narration'
import { useTVNavigation } from './useTVNavigation'
import { avatarGlyph, labels, TVButton } from './KidsUI'
import { KidsGameView } from './KidsGameView'
import type { PlayState } from './types'
import { ParentArea } from './KidsParent'
import { playKidsSound } from './sound'
import type { ChildProfile } from '@family-expense-tracker/shared'
import './kids.css'

const activeKey = (householdId: string) => `kids-child-${householdId}`
const stateKey = (householdId: string, childId: string) => `kids-session-${householdId}-${childId}`
const recentKey = (householdId: string, childId: string, gameType: GameType) =>
  `kids-recent-${householdId}-${childId}-${gameType}`
export function KidsApp() {
  const { household } = useHousehold()
  const routerNavigate = useNavigate(),
    location = useLocation()
  const navigate = useCallback(
    (path: string) => {
      void routerNavigate(path)
    },
    [routerNavigate],
  )
  const householdId = household?.id
  const root = useRef<HTMLDivElement>(null)
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [childId, setChildId] = useState<string | null>(null)
  const [progress, setProgress] = useState<KidsProgress[]>([])
  const [customLogic, setCustomLogic] = useState<LogicScenario[]>([])
  const [play, setPlay] = useState<PlayState | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [observeClock, setObserveClock] = useState(0)
  const answerLock = useRef(false)
  const wrongUnlock = useRef<number | undefined>(undefined)
  const lastHubBack = useRef(0)
  const child = children.find((item) => item.id === childId)
  const isParent = location.pathname.startsWith('/kids/parent')
  const isGame = Boolean(play && play.phase !== 'complete' && !isParent)

  useEffect(() => {
    if (!householdId) return
    let live = true
    void Promise.allSettled([
      listChildren(householdId),
      listProgress(householdId),
      listCustomLogic(householdId),
    ]).then(([c, p, l]) => {
      if (!live) return
      if (c.status === 'fulfilled') {
        setChildren(c.value)
        const saved = localStorage.getItem(activeKey(householdId))
        setChildId(
          c.value.find((item) => item.id === saved)?.id ??
            (c.value.length === 1 ? c.value[0]!.id : null),
        )
      } else setError('Δεν ήταν δυνατή η φόρτωση. Δοκίμασε ξανά.')
      if (p.status === 'fulfilled') setProgress(p.value)
      if (l.status === 'fulfilled') setCustomLogic(l.value)
      setLoading(false)
    })
    void flushKidsWrites()
    window.addEventListener('online', flushKidsWrites)
    return () => {
      live = false
      window.removeEventListener('online', flushKidsWrites)
    }
  }, [householdId])
  useEffect(() => {
    if (!isParent || !householdId) return
    void flushKidsWrites()
      .then(() => listProgress(householdId))
      .then(setProgress)
      .catch(() => undefined)
  }, [isParent, householdId])
  useEffect(() => {
    if (!householdId || !childId) return
    localStorage.setItem(activeKey(householdId), childId)
    const saved = sessionStorage.getItem(stateKey(householdId, childId))
    if (saved) {
      try {
        const state = JSON.parse(saved) as PlayState
        if (state.childProfileId === childId && state.rounds.length > 0) setPlay(state)
      } catch {
        sessionStorage.removeItem(stateKey(householdId, childId))
      }
    }
  }, [householdId, childId])
  useEffect(() => {
    if (!householdId || !play) return
    if (play.phase === 'complete')
      sessionStorage.removeItem(stateKey(householdId, play.childProfileId))
    else sessionStorage.setItem(stateKey(householdId, play.childProfileId), JSON.stringify(play))
  }, [householdId, play])
  useEffect(() => {
    if (!isGame) narration.cancel()
  }, [isGame])
  const round = play?.rounds[play.index]
  useEffect(() => {
    if (!round || !child?.narrationEnabled || !isGame) return
    narration.speak(
      play?.phase === 'observe' ? labels.look : round.narrationText,
      true,
      round.narrationAudioUrl,
    )
    return () => narration.cancel()
  }, [round, play?.phase, child?.narrationEnabled, isGame])
  useEffect(() => {
    if (!play || play.phase !== 'observe' || !round || round.gameType !== 'MEMORY') return
    setObserveClock(round.observeMs)
    const start = Date.now()
    const interval = window.setInterval(
      () => setObserveClock(Math.max(0, round.observeMs - (Date.now() - start))),
      100,
    )
    const timer = window.setTimeout(
      () =>
        setPlay((current) =>
          current?.phase === 'observe' ? { ...current, phase: 'hide' } : current,
        ),
      round.observeMs,
    )
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timer)
    }
  }, [play, round])
  useEffect(() => {
    if (!play || play.phase !== 'hide') return
    const timer = window.setTimeout(
      () =>
        setPlay((current) =>
          current?.phase === 'hide' ? { ...current, phase: 'answer' } : current,
        ),
      600,
    )
    return () => window.clearTimeout(timer)
  }, [play])

  const back = useCallback(() => {
    narration.cancel()
    if (isParent) {
      navigate('/kids')
      return
    }
    if (window.location.pathname === '/kids') {
      setPlay(null)
      const now = Date.now()
      if (now - lastHubBack.current < 2500) navigate('/kids/parent')
      else {
        lastHubBack.current = now
        setMessage('Πάτησε Πίσω ξανά για γονείς')
      }
      return
    }
    setPlay(null)
    navigate('/kids')
  }, [isParent, navigate])
  useTVNavigation(root, back, `${location.pathname}-${play?.phase}-${play?.index}-${loading}`)
  useEffect(() => {
    if (play?.phase === 'answer')
      root.current?.querySelector<HTMLElement>('.kids-round [data-tv-focus]')?.focus()
  }, [play?.sessionId, play?.index, play?.phase])
  useEffect(() => {
    const handle = () => {
      if (location.pathname.startsWith('/kids')) {
        narration.cancel()
        setPlay(null)
        queueMicrotask(() => navigate('/kids'))
      }
    }
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [location.pathname, navigate])

  function chooseProfile(id: string) {
    narration.cancel()
    setPlay(null)
    setChildId(id)
    navigate('/kids')
  }
  function start(gameType: GameType, selectedWorld?: string) {
    if (!household || !child) return
    narration.cancel()
    window.clearTimeout(wrongUnlock.current)
    answerLock.current = false
    setMessage('')
    const difficulty =
      child.defaultDifficultyMode === 'AUTO'
        ? (progress.find((item) => item.childProfileId === child.id && item.gameType === gameType)
            ?.currentDifficulty ?? 1)
        : (({ EASY: 1, MEDIUM: 2, HARD: 3 } as Record<string, number>)[
            child.defaultDifficultyMode
          ] ?? 1)
    const random = seededRandom(Math.floor(Math.random() * 0xffffffff))
    const count = child.sessionLength
    const historyKey = recentKey(household.id, child.id, gameType)
    let recent: string[] = []
    try {
      const value: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]')
      if (Array.isArray(value))
        recent = value.filter((item): item is string => typeof item === 'string').slice(-20)
    } catch {
      /* empty history */
    }
    const rounds =
      gameType === 'MEMORY'
        ? Array.from({ length: count }, (_, index) =>
            generateMemoryRound(difficulty, random, index),
          )
        : gameType === 'EXPLORER'
          ? generateExplorerRounds(selectedWorld ?? 'underwater', difficulty, count, random, recent)
          : generateLogicRounds(difficulty, count, random, customLogic, recent)
    if (rounds.length < count) {
      setMessage('Πάμε ξανά!')
      navigate('/kids')
      return
    }
    localStorage.setItem(
      historyKey,
      JSON.stringify([...recent, ...rounds.map((item) => item.contentId)].slice(-20)),
    )
    const sessionId = crypto.randomUUID()
    setPlay({
      sessionId,
      childProfileId: child.id,
      gameType,
      worldId: selectedWorld,
      rounds,
      index: 0,
      phase: gameType === 'MEMORY' ? 'observe' : 'answer',
      attempts: 0,
    })
    enqueueKidsWrite({
      name: 'startKidsSession',
      input: {
        householdId: household.id,
        childProfileId: child.id,
        sessionId,
        gameType,
        ...(selectedWorld ? { worldId: selectedWorld as 'underwater' | 'jungle' | 'space' } : {}),
      },
    })
    navigate(
      gameType === 'EXPLORER'
        ? `/kids/explorer/${selectedWorld}`
        : gameType === 'MEMORY'
          ? '/kids/memory'
          : '/kids/logic',
    )
  }
  function answer(id: string) {
    if (!play || !round || !household || answerLock.current || play.phase !== 'answer') return
    const correct = id === (round.gameType === 'MEMORY' ? round.missing : round.targetId)
    if (!correct) {
      answerLock.current = true
      setPlay({ ...play, attempts: play.attempts + 1 })
      setMessage(labels.retry)
      narration.speak(labels.retry, Boolean(child?.narrationEnabled), undefined, true)
      wrongUnlock.current = window.setTimeout(() => {
        answerLock.current = false
      }, 350)
      return
    }
    answerLock.current = true
    const attemptCount = play.attempts + 1
    enqueueKidsWrite({
      name: 'completeKidsRound',
      input: {
        householdId: household.id,
        childProfileId: play.childProfileId,
        sessionId: play.sessionId,
        roundId: round.id,
        contentId: round.contentId,
        skill: round.skill,
        difficulty: round.difficulty,
        isCorrect: attemptCount === 1,
        attemptCount,
      },
    })
    setMessage(labels.bravo)
    const explanation =
      round.gameType === 'LOGIC'
        ? round.scenario.options.find((option) => option.id === id)?.explanationNarration
        : undefined
    narration.speak(explanation ?? labels.bravo, Boolean(child?.narrationEnabled), undefined, true)
    playKidsSound(Boolean(child?.soundEnabled), 'correct')
    setPlay({ ...play, phase: 'correct', attempts: attemptCount })
  }
  const next = useCallback(() => {
    if (!play || play.phase !== 'correct') return
    answerLock.current = false
    setMessage('')
    if (play.index + 1 >= play.rounds.length) {
      setPlay({ ...play, phase: 'complete' })
      if (household)
        enqueueKidsWrite({
          name: 'completeKidsSession',
          input: {
            householdId: household.id,
            childProfileId: play.childProfileId,
            sessionId: play.sessionId,
          },
        })
      narration.speak(labels.finish, Boolean(child?.narrationEnabled), undefined, true)
      playKidsSound(Boolean(child?.soundEnabled), 'complete')
    } else
      setPlay({
        ...play,
        index: play.index + 1,
        phase: play.gameType === 'MEMORY' ? 'observe' : 'answer',
        attempts: 0,
      })
  }, [play, household, child])
  useEffect(() => {
    if (play?.phase !== 'correct') return
    const timer = window.setTimeout(next, 1300)
    return () => window.clearTimeout(timer)
  }, [play?.phase, next])

  return (
    <div
      ref={root}
      className="kids-root"
      data-animations={child?.animationsEnabled === false ? 'off' : 'on'}
    >
      {loading ? (
        <div className="kids-center">Πάμε!</div>
      ) : isParent ? (
        <ParentArea
          householdId={householdId ?? ''}
          children={children}
          child={child}
          progress={progress}
          customLogic={customLogic}
          onSaved={async () => {
            if (householdId) {
              const updated = await listChildren(householdId)
              setChildren(updated)
              if (updated.length === 1) setChildId(updated[0]!.id)
              setCustomLogic(await listCustomLogic(householdId))
              setProgress(await listProgress(householdId))
            }
          }}
          navigate={navigate}
        />
      ) : (
        <>
          <header className="kids-header">
            <TVButton onClick={back} className="kids-small">
              ← {labels.back}
            </TVButton>
            <div className="kids-brand">
              {child ? `${avatarGlyph[child.avatarId ?? 'star']} ${child.displayName}` : labels.hub}
            </div>
            <TVButton
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen()
                else void document.documentElement.requestFullscreen?.().catch(() => undefined)
              }}
              className="kids-small"
              ariaLabel="Πλήρης οθόνη"
            >
              ⛶
            </TVButton>
          </header>
          {error ? (
            <div role="alert" className="kids-message">
              {error}
            </div>
          ) : null}
          {!child ? (
            <main className="kids-center">
              <h1>{children.length ? 'Ποιος παίζει;' : 'Πάμε να παίξουμε!'}</h1>
              <div className="kids-choices">
                {children.map((item, index) => (
                  <TVButton
                    key={item.id}
                    onClick={() => chooseProfile(item.id)}
                    primary={index === 0}
                  >
                    {avatarGlyph[item.avatarId ?? 'star']} {item.displayName}
                  </TVButton>
                ))}
                <TVButton onClick={() => navigate('/kids/parent')}>{labels.parent}</TVButton>
              </div>
            </main>
          ) : play && play.phase === 'complete' ? (
            <main className="kids-center">
              <div className="kids-reward">
                {worlds.find((item) => item.id === play.worldId)?.reward ?? '✨'}
              </div>
              <h1>{labels.finish}</h1>
              <div className="kids-choices">
                <TVButton onClick={() => start(play.gameType, play.worldId)}>
                  {labels.again}
                </TVButton>
                <TVButton
                  onClick={() => {
                    setPlay(null)
                    navigate('/kids')
                  }}
                >
                  {labels.hub}
                </TVButton>
              </div>
            </main>
          ) : play &&
            round &&
            location.pathname !== '/kids' &&
            location.pathname !== '/kids/explorer' ? (
            <KidsGameView
              play={play}
              round={round}
              child={child}
              observeClock={observeClock}
              answer={answer}
              message={message}
              next={next}
            />
          ) : location.pathname === '/kids/explorer' ? (
            <main className="kids-center">
              <h1>{labels.explorer}</h1>
              <div className="kids-world-list">
                {worlds.map((world, index) => (
                  <TVButton
                    key={world.id}
                    primary={index === 0}
                    onClick={() => start('EXPLORER', world.id)}
                    className={`kids-world-card ${world.backdrop}`}
                  >
                    {world.id === 'underwater' ? '🐙' : world.id === 'jungle' ? '🦜' : '🪐'}
                    <span>{world.title}</span>
                  </TVButton>
                ))}
              </div>
            </main>
          ) : (
            <main className="kids-center">
              <h1>{labels.hub}</h1>
              <div className="kids-hub-cards">
                <TVButton primary onClick={() => navigate('/kids/explorer')}>
                  <span>🌍</span>
                  {labels.explorer}
                </TVButton>
                <TVButton onClick={() => start('MEMORY')}>
                  <span>🧠</span>
                  {labels.memory}
                </TVButton>
                <TVButton onClick={() => start('LOGIC')}>
                  <span>💡</span>
                  {labels.logic}
                </TVButton>
              </div>
              <p className="kids-message" role="status">
                {message}
              </p>
            </main>
          )}
        </>
      )}
    </div>
  )
}
