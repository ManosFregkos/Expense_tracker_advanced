import {
  KIDS_CARD_GAME_MODES,
  type KidsCardGameMode,
  type KidsDifficulty,
} from '@family-expense-tracker/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useHousehold } from '../../households/HouseholdProvider'
import { LearningCardView } from '../components/LearningCardView'
import { RepeatNarrationButton } from '../components/RepeatNarrationButton'
import { TVCardGrid } from '../components/TVCardGrid'
import {
  CARDS_BY_ID,
  DECKS_BY_ID,
  SYSTEM_RELATIONSHIPS,
  getSupportedModes,
} from '../content/system'
import { KidsRoundGenerator } from '../engine/KidsRoundGenerator'
import type { KidsCardRound } from '../engine/types'
import { kidsStrings } from '../i18n'
import { useKidsProfiles, useKidsSettings } from '../hooks'
import { kidsNarration } from '../services/KidsNarrationService'
import { kidsPersistence } from '../services/kidsPersistence'

type EngineState =
  | 'LOADING'
  | 'TEACHING'
  | 'READY'
  | 'ANSWERING'
  | 'FEEDBACK'
  | 'TRANSITIONING'
  | 'COMPLETE'
  | 'ERROR'

function isMode(value: string): value is KidsCardGameMode {
  return KIDS_CARD_GAME_MODES.includes(value as KidsCardGameMode)
}

function cardOptions(round: KidsCardRound): string[] {
  if (
    round.mode === 'LEARN_AND_CHOOSE' ||
    round.mode === 'MATCHING' ||
    round.mode === 'ODD_ONE_OUT'
  )
    return round.optionCardIds
  if (round.mode === 'COMPARE') return round.options.map((option) => option.cardId)
  return []
}

function correctAnswer(round: KidsCardRound): string {
  return round.mode === 'SAME_OR_DIFFERENT' ? round.correctAnswer : round.correctCardId
}

function feedbackFor(round: KidsCardRound): string {
  if (round.mode === 'SAME_OR_DIFFERENT')
    return `Ναι! Είναι ${round.correctAnswer === 'SAME' ? 'ίδια' : 'διαφορετικά'}.`
  if (round.mode === 'MATCHING')
    return `Μπράβο! ${SYSTEM_RELATIONSHIPS.find((item) => item.id === round.relationshipId)?.narration ?? 'Αυτά ταιριάζουν.'}`
  const card = CARDS_BY_ID.get(round.correctCardId)
  if (round.mode === 'ODD_ONE_OUT')
    return `Μπράβο! ${card?.title ?? 'Αυτό'} δεν ταιριάζει με τα άλλα.`
  if (round.mode === 'COMPARE') return `Ναι! ${card?.title ?? 'Αυτό'} είναι η σωστή επιλογή.`
  return `Μπράβο! Αυτό είναι ${card?.title ?? 'η σωστή κάρτα'}.`
}

function seedFrom(value: string) {
  return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 17)
}

function createSessionId() {
  const randomId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `kids-${randomId}`
}

function playFeedbackSound(correct: boolean, enabled: boolean) {
  if (!enabled || typeof AudioContext === 'undefined') return
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = correct ? 523 : 330
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.23)
    oscillator.addEventListener('ended', () => void context.close(), { once: true })
  } catch {
    // Sound is an enhancement and must never interrupt play.
  }
}

export function KidsSessionPage() {
  const { mode = '', deckId = '' } = useParams()
  const navigate = useNavigate()
  const { household } = useHousehold()
  const profiles = useKidsProfiles()
  const storedProfileId = localStorage.getItem('activeKidsProfileId')
  const profileId = profiles.data
    ? profiles.data.some((profile) => profile.id === storedProfileId)
      ? (storedProfileId ?? undefined)
      : profiles.data[0]?.id
    : (storedProfileId ?? undefined)
  const settings = useKidsSettings(profileId)
  const sessionId = useRef(createSessionId())
  const lock = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [state, setState] = useState<EngineState>('LOADING')
  const [attemptCount, setAttemptCount] = useState(0)
  const [selected, setSelected] = useState<string>()
  const [feedback, setFeedback] = useState('')
  const deck = DECKS_BY_ID.get(deckId)
  const valid = isMode(mode) && deck?.enabled && getSupportedModes(deck).includes(mode)
  const rounds = useMemo(() => {
    if (!valid || !settings.data || !isMode(mode)) return []
    return new KidsRoundGenerator().generateSession({
      mode,
      deckId,
      difficulty: settings.data.currentDifficulty as KidsDifficulty,
      roundCount: settings.data.sessionLength,
      seed: seedFrom(sessionId.current),
    })
  }, [deckId, mode, settings.data, valid])
  const round = rounds[roundIndex]

  const narrate = useCallback(
    (text: string) => {
      if (settings.data?.narrationEnabled) void kidsNarration.speak({ text })
    },
    [settings.data?.narrationEnabled],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      kidsNarration.cancel()
    },
    [],
  )

  useEffect(() => {
    if (!settings.data || !household || !profileId || !valid) return
    if (!rounds.length) {
      setState('ERROR')
      return
    }
    kidsPersistence.start({
      householdId: household.id,
      sessionId: sessionId.current,
      childProfileId: profileId,
      mode: mode as KidsCardGameMode,
      deckIds: [deckId],
      difficulty: settings.data.currentDifficulty,
      plannedRounds: settings.data.sessionLength,
    })
    setState(rounds[0]?.mode === 'LEARN_AND_CHOOSE' ? 'TEACHING' : 'READY')
  }, [deckId, household, mode, profileId, rounds, settings.data, valid])

  useEffect(() => {
    if (!round) return
    if (state === 'TEACHING' && round.mode === 'LEARN_AND_CHOOSE') {
      const text = round.teachingCardIds
        .map((id) => CARDS_BY_ID.get(id)?.narration)
        .filter(Boolean)
        .join(' ')
      narrate(text)
    } else if (state === 'READY') narrate(round.narrationText)
    else if (state === 'FEEDBACK') narrate(feedback)
  }, [feedback, narrate, round, state])

  useEffect(() => {
    window.dispatchEvent(new Event('kids:focus-reset'))
  }, [roundIndex, state])

  const answer = (answerId: string) => {
    if (!round || state !== 'READY' || lock.current || !household || !profileId || !settings.data)
      return
    lock.current = true
    setState('ANSWERING')
    setSelected(answerId)
    const nextAttempt = attemptCount + 1
    const isCorrect = answerId === correctAnswer(round)
    playFeedbackSound(isCorrect, settings.data.soundEffectsEnabled)
    setAttemptCount(nextAttempt)
    kidsPersistence.attempt({
      householdId: household.id,
      sessionId: sessionId.current,
      attemptId: `${sessionId.current}-${round.id}-${nextAttempt}`,
      childProfileId: profileId,
      mode: round.mode,
      roundId: round.id,
      contentId: correctAnswer(round),
      deckId: round.deckId,
      selectedOptionIds: [answerId],
      isCorrect,
      attemptCount: nextAttempt,
      difficulty: round.difficulty,
    })
    const message = isCorrect ? feedbackFor(round) : kidsStrings.tryAgain
    setFeedback(message)
    setState('FEEDBACK')
    timer.current = setTimeout(
      () => {
        if (!isCorrect) {
          setSelected(undefined)
          setFeedback('')
          setState('READY')
          lock.current = false
          return
        }
        setState('TRANSITIONING')
        if (roundIndex + 1 >= rounds.length) {
          kidsPersistence.complete({
            householdId: household.id,
            sessionId: sessionId.current,
            childProfileId: profileId,
            completedRounds: rounds.length,
          })
          setState('COMPLETE')
          return
        }
        setRoundIndex((current) => current + 1)
        setAttemptCount(0)
        setSelected(undefined)
        setFeedback('')
        const next = rounds[roundIndex + 1]
        setState(next?.mode === 'LEARN_AND_CHOOSE' ? 'TEACHING' : 'READY')
        lock.current = false
      },
      isCorrect ? 1500 : 1100,
    )
  }

  if (!valid)
    return (
      <section className="kids-center">
        <h1>Πάμε ξανά!</h1>
        <button
          type="button"
          className="kids-primary-action"
          data-tv-focusable="true"
          data-tv-autofocus="true"
          onClick={() => void navigate('/kids')}
        >
          ΠΑΙΧΝΙΔΙΑ
        </button>
      </section>
    )
  if (profiles.isLoading || settings.isLoading || state === 'LOADING')
    return <div className="kids-center">Ετοιμαζόμαστε…</div>
  if (!profileId)
    return (
      <section className="kids-center">
        <h1>Πάμε ξανά!</h1>
        <button
          type="button"
          className="kids-primary-action"
          data-tv-focusable="true"
          data-tv-autofocus="true"
          onClick={() => void navigate('/kids')}
        >
          ΠΑΙΧΝΙΔΙΑ
        </button>
      </section>
    )
  if (state === 'ERROR' || !round)
    return (
      <section className="kids-center">
        <h1>Πάμε ξανά!</h1>
        <button
          type="button"
          className="kids-primary-action"
          data-tv-focusable="true"
          data-tv-autofocus="true"
          onClick={() => void navigate('/kids')}
        >
          ΠΑΙΧΝΙΔΙΑ
        </button>
      </section>
    )
  if (state === 'COMPLETE')
    return (
      <section className="kids-complete">
        <div aria-hidden="true">🌟</div>
        <h1>{kidsStrings.complete}</h1>
        <div className="kids-complete-actions">
          <button
            type="button"
            data-tv-focusable="true"
            data-tv-autofocus="true"
            onClick={() => window.location.reload()}
          >
            {kidsStrings.again}
          </button>
          <button type="button" data-tv-focusable="true" onClick={() => void navigate('/kids')}>
            {kidsStrings.games}
          </button>
        </div>
      </section>
    )

  const showHint = attemptCount >= 2 && state === 'READY'
  const isDisabled = state !== 'READY'
  const teachingText =
    round.mode === 'LEARN_AND_CHOOSE'
      ? round.teachingCardIds
          .map((id) => CARDS_BY_ID.get(id)?.narration)
          .filter(Boolean)
          .join(' ')
      : ''
  return (
    <section
      className="kids-round"
      data-state={state.toLowerCase()}
      data-animations={settings.data?.animationsEnabled ?? false}
    >
      <div className="kids-round-top">
        <div
          className="kids-progress-dots"
          aria-label={`Γύρος ${roundIndex + 1} από ${rounds.length}`}
        >
          {rounds.map((item, index) => (
            <span
              key={item.id}
              data-done={index < roundIndex}
              data-current={index === roundIndex}
            />
          ))}
        </div>
        <RepeatNarrationButton
          autofocus={state === 'ANSWERING' || state === 'FEEDBACK' || state === 'TRANSITIONING'}
          onRepeat={() =>
            narrate(
              state === 'TEACHING'
                ? teachingText
                : state === 'FEEDBACK'
                  ? feedback
                  : round.narrationText,
            )
          }
        />
      </div>
      {state === 'TEACHING' && round.mode === 'LEARN_AND_CHOOSE' ? (
        <>
          <h1>Ας γνωρίσουμε τις κάρτες!</h1>
          <TVCardGrid>
            {round.teachingCardIds.map((id) => {
              const card = CARDS_BY_ID.get(id)
              return card ? <LearningCardView key={id} card={card} interactive={false} /> : null
            })}
          </TVCardGrid>
          <button
            type="button"
            className="kids-primary-action kids-continue"
            data-tv-focusable="true"
            data-tv-autofocus="true"
            onClick={() => {
              setState('READY')
              lock.current = false
            }}
          >
            {kidsStrings.continue}
          </button>
        </>
      ) : (
        <>
          <h1>{round.instructionText}</h1>
          {round.mode === 'MATCHING' && CARDS_BY_ID.get(round.sourceCardId) ? (
            <div className="kids-matching-source">
              <LearningCardView card={CARDS_BY_ID.get(round.sourceCardId)!} interactive={false} />
              <span aria-hidden="true">→</span>
            </div>
          ) : null}
          {round.mode === 'SAME_OR_DIFFERENT' ? (
            <>
              <TVCardGrid>
                {round.cardIds.map((id, index) => {
                  const card = CARDS_BY_ID.get(id)
                  return card ? (
                    <LearningCardView key={`${id}-${index}`} card={card} interactive={false} />
                  ) : null
                })}
              </TVCardGrid>
              <div className="kids-answer-actions">
                <button
                  type="button"
                  disabled={isDisabled}
                  data-hint={showHint && round.correctAnswer === 'SAME'}
                  data-tv-focusable="true"
                  data-tv-autofocus="true"
                  onClick={() => answer('SAME')}
                >
                  {kidsStrings.same}
                </button>
                <button
                  type="button"
                  disabled={isDisabled}
                  data-hint={showHint && round.correctAnswer === 'DIFFERENT'}
                  data-tv-focusable="true"
                  onClick={() => answer('DIFFERENT')}
                >
                  {kidsStrings.different}
                </button>
              </div>
            </>
          ) : (
            <TVCardGrid>
              {cardOptions(round).map((id, index) => {
                const card = CARDS_BY_ID.get(id)
                return card ? (
                  <LearningCardView
                    key={id}
                    card={card}
                    autofocus={index === 0}
                    disabled={isDisabled}
                    selected={selected === id}
                    correct={state === 'FEEDBACK' && selected === id && id === correctAnswer(round)}
                    hint={showHint && id === correctAnswer(round)}
                    onActivate={() => answer(id)}
                  />
                ) : null
              })}
            </TVCardGrid>
          )}
        </>
      )}
      {feedback ? (
        <div className="kids-feedback" role="status">
          {feedback}
        </div>
      ) : null}
    </section>
  )
}
