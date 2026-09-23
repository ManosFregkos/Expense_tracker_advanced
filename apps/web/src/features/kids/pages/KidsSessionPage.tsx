import {
  KIDS_CARD_GAME_MODES,
  type KidsCardGameMode,
  type KidsDifficulty,
} from '@family-expense-tracker/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useHousehold } from '../../households/HouseholdProvider'
import { LearningCardView } from '../components/LearningCardView'
import { AssetChoiceCard } from '../components/AssetChoiceCard'
import { MemoryPairsBoard } from '../components/MemoryPairsBoard'
import { RepeatNarrationButton } from '../components/RepeatNarrationButton'
import { TVCardGrid } from '../components/TVCardGrid'
import {
  CARDS_BY_ID,
  DECKS_BY_ID,
  KIDS_ASSETS,
  SYSTEM_RELATIONSHIPS,
  getSupportedModes,
} from '../content/system'
import { CLASSIFICATION_DESTINATIONS } from '../content/system/advanced'
import { KidsRoundGenerator } from '../engine/KidsRoundGenerator'
import type { KidsCardRound } from '../engine/types'
import { kidsStrings } from '../i18n'
import { useKidsContent, useKidsProfiles, useKidsProgress, useKidsSettings } from '../hooks'
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
  if (round.mode === 'SAME_OR_DIFFERENT') return round.correctAnswer
  if (round.mode === 'EVERYDAY_CHOICE') return round.correctChoiceId
  if (round.mode === 'CLASSIFY') return round.correctDestinationId
  if (round.mode === 'SEQUENCE') return round.correctStepId
  if (round.mode === 'EMOTION') return round.expectedEmotion
  if (round.mode === 'MEMORY_PAIRS') return round.contentIds[0] ?? round.id
  return round.correctCardId
}

function feedbackFor(round: KidsCardRound): string {
  if (round.mode === 'SAME_OR_DIFFERENT')
    return `Ναι! Είναι ${round.correctAnswer === 'SAME' ? 'ίδια' : 'διαφορετικά'}.`
  if (round.mode === 'MATCHING')
    return `Μπράβο! ${SYSTEM_RELATIONSHIPS.find((item) => item.id === round.relationshipId)?.narration ?? 'Αυτά ταιριάζουν.'}`
  if (round.mode === 'EVERYDAY_CHOICE') return round.explanationNarration
  if (round.mode === 'CLASSIFY') return round.explanationNarration
  if (round.mode === 'SEQUENCE')
    return round.explanationNarration ?? 'Ναι! Αυτή είναι η σωστή σειρά.'
  if (round.mode === 'EMOTION')
    return round.explanationNarration ?? 'Ναι! Αυτό ταιριάζει στην ιστορία.'
  if (round.mode === 'MEMORY_PAIRS') return 'Μπράβο! Βρήκες όλα τα ζευγάρια.'
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

function readRecentContent(profileId: string | undefined): string[] {
  if (!profileId) return []
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`kids-recent-content-${profileId}`) ?? '[]',
    )
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
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
  const [searchParams] = useSearchParams()
  const { household } = useHousehold()
  const profiles = useKidsProfiles()
  const content = useKidsContent()
  const requestedProfileId = searchParams.get('profile')
  const storedProfileId = requestedProfileId ?? localStorage.getItem('activeKidsProfileId')
  const profileId = profiles.data
    ? profiles.data.some((profile) => profile.id === storedProfileId)
      ? (storedProfileId ?? undefined)
      : profiles.data[0]?.id
    : (storedProfileId ?? undefined)
  const settings = useKidsSettings(profileId)
  const progress = useKidsProgress(profileId)
  const sessionId = useRef(createSessionId())
  const lock = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [state, setState] = useState<EngineState>('LOADING')
  const [attemptCount, setAttemptCount] = useState(0)
  const [selected, setSelected] = useState<string>()
  const [feedback, setFeedback] = useState('')
  const deck = DECKS_BY_ID.get(deckId)
  const preview = searchParams.get('preview') === 'true'
  const requestedDifficulty = Number(searchParams.get('difficulty'))
  const requestedRounds = Number(searchParams.get('rounds'))
  const recentContentIds = useMemo(() => readRecentContent(profileId), [profileId])
  const valid =
    isMode(mode) &&
    deck !== undefined &&
    (deck.enabled || preview) &&
    (mode === 'MIXED_PLAY' || getSupportedModes(deck).includes(mode))
  const rounds = useMemo(() => {
    if (!valid || !settings.data || !isMode(mode)) return []
    const fixedDifficulty = { EASY: 1, MEDIUM: 2, HARD: 4 } as const
    const difficulty =
      requestedDifficulty >= 1 && requestedDifficulty <= 4
        ? (requestedDifficulty as KidsDifficulty)
        : settings.data.difficultyMode === 'AUTO'
          ? (settings.data.modeDifficulties?.[mode] ?? settings.data.currentDifficulty)
          : fixedDifficulty[settings.data.difficultyMode]
    return new KidsRoundGenerator().generateSession({
      mode,
      deckId,
      difficulty: difficulty as KidsDifficulty,
      roundCount: [5, 10, 15].includes(requestedRounds)
        ? requestedRounds
        : settings.data.sessionLength,
      seed: seedFrom(sessionId.current),
      cardProgress: progress.data ?? [],
      recentContentIds,
    })
  }, [
    deckId,
    mode,
    progress.data,
    recentContentIds,
    requestedDifficulty,
    requestedRounds,
    settings.data,
    valid,
  ])
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
    if (!preview)
      kidsPersistence.start({
        householdId: household.id,
        sessionId: sessionId.current,
        childProfileId: profileId,
        mode: mode as KidsCardGameMode,
        deckIds: [deckId],
        difficulty:
          requestedDifficulty >= 1 && requestedDifficulty <= 4
            ? (requestedDifficulty as KidsDifficulty)
            : settings.data.difficultyMode === 'AUTO'
              ? (settings.data.modeDifficulties?.[mode as KidsCardGameMode] ??
                settings.data.currentDifficulty)
              : ({ EASY: 1, MEDIUM: 2, HARD: 4 } as const)[settings.data.difficultyMode],
        plannedRounds: rounds.length as 5 | 10 | 15,
      })
    setState(rounds[0]?.mode === 'LEARN_AND_CHOOSE' ? 'TEACHING' : 'READY')
  }, [
    deckId,
    household,
    mode,
    preview,
    profileId,
    requestedDifficulty,
    rounds,
    settings.data,
    valid,
  ])

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

  useEffect(() => {
    const assetIds = [round, rounds[roundIndex + 1]].flatMap((item) => item?.contentIds ?? [])
    for (const id of assetIds) {
      const card = CARDS_BY_ID.get(id)
      const url = card?.assetUrl ?? KIDS_ASSETS.get(card?.assetId ?? id)?.url
      if (url) {
        const image = new Image()
        image.decoding = 'async'
        image.src = url
      }
    }
  }, [round, roundIndex, rounds])

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
    if (!preview)
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
    const shouldAdvance = isCorrect || nextAttempt >= 3
    if (shouldAdvance) {
      const recent = [...round.contentIds, ...readRecentContent(profileId)]
      localStorage.setItem(
        `kids-recent-content-${profileId}`,
        JSON.stringify([...new Set(recent)].slice(0, 20)),
      )
    }
    const message = shouldAdvance ? feedbackFor(round) : kidsStrings.tryAgain
    setFeedback(message)
    setState('FEEDBACK')
    timer.current = setTimeout(
      () => {
        if (!shouldAdvance) {
          setSelected(undefined)
          setFeedback('')
          setState('READY')
          lock.current = false
          return
        }
        setState('TRANSITIONING')
        if (roundIndex + 1 >= rounds.length) {
          if (!preview)
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
      shouldAdvance ? 1800 : 1100,
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
  if (
    profiles.isLoading ||
    content.isLoading ||
    progress.isLoading ||
    settings.isLoading ||
    state === 'LOADING'
  )
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
            autoFocus
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
          {round.mode === 'CLASSIFY' && CARDS_BY_ID.get(round.sourceCardId) ? (
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
          ) : round.mode === 'EVERYDAY_CHOICE' ? (
            <TVCardGrid>
              {round.options.map((option, index) => (
                <AssetChoiceCard
                  key={option.id}
                  assetId={option.assetId}
                  label={option.narration}
                  autofocus={index === 0}
                  disabled={isDisabled}
                  selected={selected === option.id}
                  correct={
                    state === 'FEEDBACK' &&
                    selected === option.id &&
                    option.id === round.correctChoiceId
                  }
                  hint={showHint && option.id === round.correctChoiceId}
                  onActivate={() => answer(option.id)}
                />
              ))}
            </TVCardGrid>
          ) : round.mode === 'CLASSIFY' ? (
            <TVCardGrid>
              {round.destinationIds.map((id, index) => {
                const destination = CLASSIFICATION_DESTINATIONS.get(id)
                const destinationCard = CARDS_BY_ID.get(id)
                if (destinationCard)
                  return (
                    <LearningCardView
                      key={id}
                      card={destinationCard}
                      autofocus={index === 0}
                      disabled={isDisabled}
                      selected={selected === id}
                      correct={
                        state === 'FEEDBACK' && selected === id && id === round.correctDestinationId
                      }
                      hint={showHint && id === round.correctDestinationId}
                      onActivate={() => answer(id)}
                    />
                  )
                return (
                  <AssetChoiceCard
                    key={id}
                    assetId={id}
                    label={destination?.label ?? 'θέση'}
                    autofocus={index === 0}
                    disabled={isDisabled}
                    selected={selected === id}
                    correct={
                      state === 'FEEDBACK' && selected === id && id === round.correctDestinationId
                    }
                    hint={showHint && id === round.correctDestinationId}
                    onActivate={() => answer(id)}
                  />
                )
              })}
            </TVCardGrid>
          ) : round.mode === 'SEQUENCE' ? (
            <>
              <div className="kids-sequence">
                {round.slots.map((slot, index) => {
                  const asset = slot.assetId ? KIDS_ASSETS.get(slot.assetId) : undefined
                  return (
                    <div
                      className="kids-sequence-slot"
                      key={slot.stepId}
                      data-missing={slot.missing}
                    >
                      <span>{slot.missing ? '?' : (asset?.symbol ?? '⭐')}</span>
                      <small>{slot.missing ? 'Τι λείπει;' : slot.narration}</small>
                      {index < round.slots.length - 1 ? <b aria-hidden="true">→</b> : null}
                    </div>
                  )
                })}
              </div>
              <TVCardGrid>
                {round.optionSteps.map((step, index) => (
                  <AssetChoiceCard
                    key={step.id}
                    assetId={step.assetId}
                    label={step.narration}
                    autofocus={index === 0}
                    disabled={isDisabled}
                    selected={selected === step.id}
                    correct={
                      state === 'FEEDBACK' &&
                      selected === step.id &&
                      step.id === round.correctStepId
                    }
                    hint={showHint && step.id === round.correctStepId}
                    onActivate={() => answer(step.id)}
                  />
                ))}
              </TVCardGrid>
            </>
          ) : round.mode === 'EMOTION' ? (
            <>
              <div className="emotion-scene" aria-label={round.narrationText}>
                {KIDS_ASSETS.get(round.sceneAssetId)?.symbol ?? '🙂'}
              </div>
              <TVCardGrid>
                {round.options.map((emotion, index) => (
                  <AssetChoiceCard
                    key={emotion}
                    assetId={`emotion-${emotion.toLowerCase()}`}
                    label={
                      {
                        HAPPY: 'χαρούμενος',
                        SAD: 'λυπημένος',
                        ANGRY: 'θυμωμένος',
                        SCARED: 'φοβισμένος',
                        SURPRISED: 'έκπληκτος',
                        TIRED: 'κουρασμένος',
                      }[emotion]
                    }
                    autofocus={index === 0}
                    disabled={isDisabled}
                    selected={selected === emotion}
                    correct={
                      state === 'FEEDBACK' &&
                      selected === emotion &&
                      emotion === round.expectedEmotion
                    }
                    hint={showHint && emotion === round.expectedEmotion}
                    onActivate={() => answer(emotion)}
                  />
                ))}
              </TVCardGrid>
            </>
          ) : round.mode === 'MEMORY_PAIRS' ? (
            <MemoryPairsBoard round={round} onComplete={() => answer(correctAnswer(round))} />
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
