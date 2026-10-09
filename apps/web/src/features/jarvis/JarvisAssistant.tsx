import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { IconMicrophone, IconPlayerStop, IconRobot, IconVolume } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { taskKeys } from '../../lib/query-keys'
import { FirebaseError } from 'firebase/app'
import type {
  JarvisMessage,
  JarvisReply,
  JarvisExpenseDraft,
  JarvisTaskAction,
  JarvisMorningBriefing,
} from '@family-expense-tracker/shared'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { useHousehold } from '../households/HouseholdProvider'
import { TransactionDrawer } from '../transactions/TransactionDrawer'
import { parseJarvisCommand } from './commands'
import { blobToBase64, JarvisVoiceInput, voiceCapabilities } from './voice-input'
import { JarvisRealtimeVoice, type RealtimeState } from './realtime-voice'
import {
  jarvisCopy,
  jarvisExamples,
  readJarvisLanguage,
  saveJarvisLanguage,
  taskConfirmation,
  taskPreview,
  type JarvisLanguage,
} from './language'
import { MorningBriefing } from './MorningBriefing'

type ChatEntry = JarvisMessage & { sources?: JarvisReply['sources'] }
export function JarvisAssistant() {
  const { household } = useHousehold()
  return household ? <AssistantSession key={household.id} householdId={household.id} /> : null
}

function AssistantSession({ householdId }: { householdId: string }) {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const history = useRef<ChatEntry[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [awake, setAwake] = useState(false)
  const awakeRef = useRef(false)
  const [mic, setMic] = useState<'off' | 'listening' | 'recording' | 'transcribing'>('off')
  const [engine, setEngine] = useState<'browser' | 'cloud'>('browser')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [speaking, setSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const lastSpoken = useRef({ text: '', time: 0 })
  const [language, setLanguage] = useState<JarvisLanguage>(readJarvisLanguage)
  const copy = jarvisCopy(language)
  const languageRef = useRef(language)
  languageRef.current = language
  const [webSearch, setWebSearch] = useState(false)
  const webSearchRef = useRef(webSearch)
  webSearchRef.current = webSearch
  const [draft, setDraft] = useState<JarvisExpenseDraft | null>(null)
  const [taskAction, setTaskAction] = useState<JarvisTaskAction | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const savingTaskRef = useRef(false)
  const [briefing, setBriefing] = useState<JarvisMorningBriefing | null>(null)
  const [review, setReview] = useState(false)
  const [playback, setPlayback] = useState<string | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)
  const voice = useRef<JarvisVoiceInput | null>(null)
  const realtime = useRef<JarvisRealtimeVoice | null>(null)
  const [liveState, setLiveState] = useState<RealtimeState>('off')
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const liveSources = useRef<JarvisReply['sources']>([])
  const generation = useRef(0)
  const alive = useRef(true)
  const speechComplete = useRef<(() => void) | null>(null)
  const consumeRef = useRef<(value: string, liveInput?: boolean) => void>(() => undefined)
  const caps = voiceCapabilities()

  function addMessage(message: ChatEntry) {
    history.current = [...history.current, message].slice(-40)
    setMessages(history.current)
  }
  function setActive(value: boolean) {
    awakeRef.current = value
    setAwake(value)
    realtime.current?.setAwake(value)
  }
  function setWorking(value: boolean) {
    busyRef.current = value
    setBusy(value)
  }
  function cancelSpeech() {
    speechComplete.current?.()
    speechComplete.current = null
    window.speechSynthesis?.cancel()
    player.current?.pause()
    player.current = null
    speakingRef.current = false
    if (alive.current) setSpeaking(false)
    voice.current?.muteRecording(false)
    realtime.current?.mute(false)
  }
  async function speak(value: string, instant = false, token = generation.current) {
    cancelSpeech()
    if (token !== generation.current || !alive.current) return
    speakingRef.current = true
    lastSpoken.current = {
      text: value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim(),
      time: Date.now(),
    }
    setSpeaking(true)
    voice.current?.muteRecording(true)
    realtime.current?.mute(true)
    try {
      // Local greeting has no AI round-trip; regular replies use the configured AI voice.
      if (!instant || !window.speechSynthesis) {
        try {
          const result = await api.jarvisSpeak({ householdId, text: value })
          if (token !== generation.current || !alive.current) return
          const source = `data:${result.mimeType};base64,${result.audio}`
          setPlayback(source)
          const audio = new Audio(source)
          player.current = audio
          await new Promise<void>((resolve, reject) => {
            speechComplete.current = resolve
            audio.onended = () => resolve()
            audio.onerror = () => reject(new Error('Could not play the answer.'))
            void audio.play().catch(reject)
          })
          return
        } catch {
          if (token !== generation.current || !alive.current) return
          // Mobile autoplay may require a second tap; retain the audio controls below.
        }
      }
      if (window.speechSynthesis) {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(value)
          utterance.lang = languageRef.current
          const voices = window.speechSynthesis.getVoices()
          utterance.voice = voices.find((item) => item.lang === utterance.lang) ?? null
          const timeout = setTimeout(resolve, 60_000)
          const done = () => {
            clearTimeout(timeout)
            resolve()
          }
          speechComplete.current = done
          utterance.onend = done
          utterance.onerror = done
          window.speechSynthesis.speak(utterance)
        })
      } else setError(jarvisCopy(languageRef.current).playbackError)
    } finally {
      if (token === generation.current && alive.current) {
        lastSpoken.current.time = Date.now()
        speakingRef.current = false
        setSpeaking(false)
        speechComplete.current = null
        voice.current?.muteRecording(false)
        realtime.current?.mute(false)
      }
    }
  }
  function stopConversation() {
    // Invalidate in-flight chat/TTS. The microphone stays enabled for the next wake phrase.
    const token = ++generation.current
    cancelSpeech()
    setWorking(false)
    setActive(false)
    setDraft(null)
    setBriefing(null)
    setTaskAction(null)
    setReview(false)
    setPlayback(null)
    liveSources.current = []
    const goodbye = jarvisCopy(languageRef.current).goodbye
    addMessage({ role: 'assistant', content: goodbye })
    void speak(goodbye, true, token)
  }
  async function ask(question: string, liveInput = false) {
    if (savingTaskRef.current) return
    if ((busyRef.current || speakingRef.current) && !realtime.current?.ready) return
    if (realtime.current?.ready) {
      generation.current++
      cancelSpeech()
      liveSources.current = []
    }
    const token = generation.current
    setWorking(true)
    setError('')
    setDraft(null)
    setBriefing(null)
    setTaskAction(null)
    setPlayback(null)
    addMessage({ role: 'user', content: question })
    if (realtime.current?.ready) {
      realtime.current.respond(liveInput ? undefined : question)
      return
    }
    try {
      const result = await api.jarvisChat({
        householdId,
        messages: history.current.slice(-20).map(({ role, content }) => ({ role, content })),
        webSearch: webSearchRef.current,
        language: languageRef.current,
      })
      if (token !== generation.current || !alive.current) return
      addMessage({ role: 'assistant', content: result.reply, sources: result.sources })
      setDraft(result.draft)
      setTaskAction(result.taskAction ?? null)
      setBriefing(result.briefing ?? null)
      setWorking(false)
      await speak(result.reply, false, token)
    } catch (reason) {
      if (token === generation.current && alive.current)
        setError(reason instanceof FirebaseError ? reason.message : friendlyError(reason))
    } finally {
      if (token === generation.current && alive.current) setWorking(false)
    }
  }
  async function consume(value: string, typed = false, liveInput = false) {
    const command = parseJarvisCommand(value, typed || awakeRef.current)
    if (command.type === 'stop') {
      // A repeated interim/final stop result should not speak goodbye twice.
      if (awakeRef.current || busyRef.current) stopConversation()
      return
    }
    if (savingTaskRef.current) return
    const heard = value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
    if (
      !typed &&
      heard.length >= 5 &&
      Date.now() - lastSpoken.current.time < 15_000 &&
      lastSpoken.current.text.includes(heard)
    )
      return
    if (savingTaskRef.current) return
    if ((busyRef.current || speakingRef.current) && !realtime.current?.ready) return
    if (command.type === 'wake') {
      if (awakeRef.current) {
        if (command.question) await ask(command.question)
        return
      }
      setActive(true)
      setOpened(true)
      const greeting = jarvisCopy(languageRef.current).greeting
      addMessage({ role: 'assistant', content: greeting })
      const token = generation.current
      await speak(greeting, true, token)
      if (token === generation.current && command.question) await ask(command.question)
    } else if (command.type === 'question') {
      setActive(true)
      await ask(command.question, liveInput)
    }
  }
  consumeRef.current = (value, liveInput = false) => {
    void consume(value, false, liveInput)
  }

  useEffect(() => {
    alive.current = true
    const sessionGeneration = generation
    const input = new JarvisVoiceInput({
      transcript: (value) => consumeRef.current(value),
      audio: async (blob) => {
        const audio = await blobToBase64(blob)
        const mimeType = blob.type.split(';')[0] as
          'audio/webm' | 'audio/mp4' | 'audio/ogg' | 'audio/wav'
        return (
          await api.jarvisTranscribe({
            householdId,
            audio,
            mimeType,
            language: languageRef.current,
          })
        ).text
      },
      state: (state, currentEngine) => {
        if (alive.current) {
          setMic(state)
          if (currentEngine) setEngine(currentEngine)
        }
      },
      error: (message) => {
        if (alive.current) setError(message)
      },
    })
    voice.current = input
    const live = new JarvisRealtimeVoice({
      connect: (sdp) =>
        api.jarvisStartRealtime({
          householdId,
          sdp,
          language: languageRef.current,
          webSearch: webSearchRef.current,
        }),
      transcript: (value) => consumeRef.current(value, true),
      answer: (value) => {
        if (!alive.current || !awakeRef.current) return
        addMessage({ role: 'assistant', content: value, sources: liveSources.current })
        liveSources.current = []
      },
      tool: async (question) => {
        const token = generation.current
        const result = await api.jarvisChat({
          householdId,
          webSearch: webSearchRef.current,
          language: languageRef.current,
          messages: [
            ...history.current.slice(-18).map(({ role, content }) => ({ role, content })),
            { role: 'user', content: question },
          ],
        })
        if (token === generation.current && alive.current && awakeRef.current) {
          setDraft(result.draft)
          setTaskAction(result.taskAction ?? null)
          setBriefing(result.briefing ?? null)
          liveSources.current = result.sources
        }
        return result
      },
      state: (state) => {
        if (!alive.current) return
        setLiveState(state)
        setWorking(state === 'thinking')
        if (!speechComplete.current) {
          speakingRef.current = state === 'speaking'
          setSpeaking(state === 'speaking')
        }
      },
      error: (message) => {
        if (alive.current) setError(message)
      },
      playbackBlocked: (blocked) => {
        if (alive.current) setPlaybackBlocked(blocked)
      },
      interrupted: () => {
        generation.current++
        liveSources.current = []
        setDraft(null)
        setBriefing(null)
        setTaskAction(null)
        cancelSpeech()
      },
    })
    realtime.current = live
    const hide = () => {
      if (document.visibilityState !== 'hidden') return
      sessionGeneration.current++
      input.stop()
      live.stop()
      window.speechSynthesis?.cancel()
      speechComplete.current?.()
      player.current?.pause()
      busyRef.current = false
      speakingRef.current = false
      awakeRef.current = false
      setBusy(false)
      setSpeaking(false)
      setAwake(false)
      setPlayback(null)
      setDraft(null)
      setBriefing(null)
      setTaskAction(null)
      setReview(false)
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      alive.current = false
      sessionGeneration.current++
      input.stop()
      live.stop()
      window.speechSynthesis?.cancel()
      speechComplete.current?.()
      player.current?.pause()
      document.removeEventListener('visibilitychange', hide)
    }
  }, [householdId])

  function disable() {
    generation.current++
    cancelSpeech()
    voice.current?.stop()
    realtime.current?.stop()
    setWorking(false)
    setActive(false)
    setPlayback(null)
    setTaskAction(null)
  }
  async function confirmTaskChange() {
    if (!taskAction || savingTaskRef.current) return
    const proposal = taskAction
    savingTaskRef.current = true
    setSavingTask(true)
    const token = ++generation.current
    cancelSpeech()
    realtime.current?.interrupt()
    voice.current?.muteRecording(true)
    realtime.current?.mute(true)
    setWorking(true)
    setError('')
    try {
      let confirmation: string
      if (proposal.kind === 'create') {
        await api.createTask({
          householdId,
          clientRequestId: proposal.clientRequestId,
          ...proposal.task,
        })
        confirmation = taskConfirmation(languageRef.current, proposal)
      } else if (proposal.kind === 'complete') {
        const result = await api.completeTask({
          householdId,
          taskId: proposal.taskId,
          expectedVersion: proposal.expectedVersion,
        })
        confirmation = taskConfirmation(languageRef.current, proposal, result.nextTaskId)
      } else {
        await api.updateTask({
          householdId,
          taskId: proposal.taskId,
          expectedVersion: proposal.expectedVersion,
          task: proposal.task,
        })
        confirmation = taskConfirmation(languageRef.current, proposal)
      }
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(householdId) })
      if (!alive.current) return
      setTaskAction(null)
      addMessage({ role: 'assistant', content: confirmation })
      setWorking(false)
      // An authorized save can finish after Stop/backgrounding. Still report its
      // actual result, but do not restart speech or interrupt the goodbye.
      if (token === generation.current && document.visibilityState !== 'hidden') {
        realtime.current?.addAppResult(confirmation)
        void speak(confirmation, true, token)
      }
    } catch (reason) {
      if (alive.current)
        setError(reason instanceof FirebaseError ? reason.message : friendlyError(reason))
    } finally {
      savingTaskRef.current = false
      if (alive.current) {
        setSavingTask(false)
        setWorking(false)
        if (!speakingRef.current) {
          voice.current?.muteRecording(false)
          realtime.current?.mute(false)
        }
      }
    }
  }
  async function enable(manual: boolean, startNow = false) {
    setError('')
    // Unlock mobile audio on the initial user gesture.
    if (window.speechSynthesis) {
      const unlock = new SpeechSynthesisUtterance('')
      window.speechSynthesis.speak(unlock)
    }
    if (!manual && caps.realtime) {
      if (!realtime.current?.ready) {
        setActive(false)
        voice.current?.stop()
        await realtime.current?.start(history.current)
      }
      if (startNow && realtime.current?.ready)
        await consume(jarvisCopy(languageRef.current).wake, true)
      return
    }
    realtime.current?.stop()
    if (manual) setActive(true)
    await voice.current?.start(language, manual)
    if (startNow) await consume(jarvisCopy(languageRef.current).wake, true)
  }
  const microphoneEnabled = mic !== 'off' || liveState !== 'off'
  const status =
    liveState === 'connecting'
      ? copy.connecting
      : busy
        ? copy.thinking
        : speaking
          ? copy.speaking
          : mic === 'transcribing'
            ? copy.transcribing
            : !microphoneEnabled
              ? copy.off
              : awake
                ? copy.listening
                : copy.waiting
  return (
    <>
      <Button
        variant={!microphoneEnabled ? 'light' : 'filled'}
        size="compact-sm"
        leftSection={<IconRobot size={18} />}
        onClick={() => setOpened(true)}
        aria-label={!microphoneEnabled ? copy.open : `${copy.open}, ${status}`}
        className="jarvis-launcher"
      >
        <span className="jarvis-label">Jarvis{microphoneEnabled ? ' •' : ''}</span>
      </Button>
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title={copy.title}
        closeButtonProps={{ 'aria-label': copy.close }}
        position="right"
        size="lg"
        trapFocus={!review}
      >
        <Stack>
          <Group justify="space-between">
            <Badge color={!microphoneEnabled ? 'gray' : 'teal'} aria-live="polite">
              {status}
            </Badge>
            <Button
              variant="subtle"
              color="red"
              onClick={disable}
              disabled={!microphoneEnabled && !busy && !speaking}
            >
              {copy.microphoneOff}
            </Button>
          </Group>
          <Text size="sm">{copy.instructions}</Text>
          <Text size="xs" c="dimmed">
            {copy.notice}
          </Text>
          <Alert color="blue" title={copy.privacy}>
            {caps.realtime
              ? copy.realtimePrivacy
              : caps.recognition
                ? copy.recognitionPrivacy
                : copy.recordingPrivacy}
          </Alert>
          {!microphoneEnabled && (
            <Alert color="teal" title={copy.firstClick}>
              {copy.firstClickHelp}
            </Alert>
          )}
          {error && (
            <Alert color="red" role="alert" withCloseButton onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Select
            label={copy.language}
            value={language}
            onChange={(value) => {
              if (value === 'el-GR' || value === 'en-US') {
                setLanguage(value)
                saveJarvisLanguage(value)
              }
            }}
            disabled={microphoneEnabled || busy || speaking || savingTask}
            data={[
              { value: 'en-US', label: copy.english },
              { value: 'el-GR', label: copy.greek },
            ]}
          />
          <Checkbox
            label={copy.web}
            checked={webSearch}
            disabled={liveState !== 'off'}
            onChange={(event) => setWebSearch(event.currentTarget.checked)}
          />
          <Group>
            {caps.realtime && (
              <Button
                leftSection={<IconMicrophone size={18} />}
                disabled={
                  liveState === 'connecting' ||
                  (liveState !== 'off' && awake) ||
                  (busy && liveState === 'off')
                }
                onClick={() => void enable(false, true)}
              >
                {copy.start}
              </Button>
            )}
            <Button
              leftSection={<IconMicrophone size={18} />}
              variant={caps.realtime ? 'light' : 'filled'}
              disabled={
                microphoneEnabled ||
                (!caps.realtime && !caps.recognition && !caps.recording) ||
                busy ||
                speaking
              }
              onClick={() => void enable(false)}
            >
              {copy.enable}
            </Button>
            <Button
              variant="light"
              disabled={
                !caps.recording ||
                liveState !== 'off' ||
                busy ||
                speaking ||
                mic === 'transcribing' ||
                (mic !== 'off' && mic !== 'recording')
              }
              onClick={() =>
                mic === 'recording' ? voice.current?.finishRecording() : void enable(true)
              }
            >
              {mic === 'recording' && engine === 'cloud' ? copy.sendRecording : copy.record}
            </Button>
            <Button
              variant="light"
              leftSection={<IconPlayerStop size={18} />}
              onClick={stopConversation}
              disabled={!awake && !busy && !speaking}
            >
              {copy.stop}
            </Button>
          </Group>
          {liveState !== 'off' && (
            <Text size="sm" c="dimmed">
              {copy.liveHelp}
            </Text>
          )}
          {playbackBlocked && (
            <Button onClick={() => void realtime.current?.playAudio()}>{copy.playLive}</Button>
          )}
          {!caps.realtime && !caps.recognition && !caps.recording && (
            <Text size="sm">{copy.unavailable}</Text>
          )}
          <Button
            variant="light"
            disabled={busy || savingTask || (speaking && liveState === 'off')}
            onClick={() => void consume(copy.briefingQuestion, true)}
          >
            {copy.briefing}
          </Button>
          <details>
            <summary>{copy.examplesTitle}</summary>
            <Text size="sm" c="dimmed">
              {copy.examplesHelp}
            </Text>
            <Stack gap="xs" mt="sm">
              {jarvisExamples(language).map((example) => (
                <Button
                  key={example}
                  variant="subtle"
                  size="compact-sm"
                  styles={{
                    label: { whiteSpace: 'normal', textAlign: 'left' },
                    root: { height: 'auto', minHeight: 30 },
                  }}
                  onClick={() => setText(example)}
                >
                  {example}
                </Button>
              ))}
            </Stack>
          </details>
          {briefing && (
            <MorningBriefing
              briefing={briefing}
              language={language}
              onOpenTask={() => {
                disable()
                setOpened(false)
              }}
            />
          )}
          <Stack role="log" aria-label={copy.log} aria-live="polite" gap="sm">
            {messages.length === 0 && (
              <Paper p="md" withBorder>
                <Text fw={600}>{copy.welcome}</Text>
                <Text size="sm" c="dimmed">
                  {copy.examplesHelp}
                </Text>
              </Paper>
            )}
            {messages.map((entry, index) => (
              <Paper
                key={index}
                p="sm"
                withBorder
                bg={entry.role === 'user' ? 'gray.0' : undefined}
              >
                <Text size="xs" fw={700} c="dimmed">
                  {entry.role === 'user' ? copy.you : 'Τζάρβις'}
                </Text>
                <Text style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {entry.content}
                </Text>
                {entry.sources?.map((source) => (
                  <Anchor
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    display="block"
                    size="sm"
                  >
                    {source.title}
                  </Anchor>
                ))}
                {entry.role === 'assistant' && (
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    leftSection={<IconVolume size={14} />}
                    disabled={busy || speaking || liveState !== 'off'}
                    onClick={() =>
                      void speak(
                        entry.content,
                        [
                          jarvisCopy('en-US').greeting,
                          jarvisCopy('en-US').goodbye,
                          jarvisCopy('el-GR').greeting,
                          jarvisCopy('el-GR').goodbye,
                        ].includes(entry.content),
                      )
                    }
                  >
                    {copy.play}
                  </Button>
                )}
              </Paper>
            ))}
          </Stack>
          {taskAction && (
            <Alert color="teal" title={copy.confirm}>
              <Text fw={600}>
                {taskAction.kind === 'complete' ? taskAction.title : taskAction.task.title}
              </Text>
              <Text size="sm">{taskPreview(language, taskAction)}</Text>
              <Text size="xs" c="dimmed">
                {copy.confirmHelp}
              </Text>
              <Group mt="sm">
                <Button
                  loading={savingTask}
                  disabled={savingTask}
                  onClick={() => void confirmTaskChange()}
                >
                  {copy.confirm}
                </Button>
                <Button
                  variant="subtle"
                  disabled={savingTask}
                  onClick={() => {
                    setTaskAction(null)
                    const content = jarvisCopy(languageRef.current).cancelled
                    addMessage({ role: 'assistant', content })
                    realtime.current?.addAppResult(content)
                  }}
                >
                  {copy.cancel}
                </Button>
              </Group>
            </Alert>
          )}
          {draft && (
            <Alert color="teal" title={copy.expense}>
              <Text size="sm">
                {draft.currency} {draft.amount} · {draft.description} · {draft.date}.{' '}
                {copy.expenseHelp}
              </Text>
              <Group mt="sm">
                <Button
                  onClick={() => {
                    disable()
                    setReview(true)
                  }}
                >
                  {copy.review}
                </Button>
                <Button variant="subtle" onClick={() => setDraft(null)}>
                  {copy.discard}
                </Button>
              </Group>
            </Alert>
          )}
          {playback && (
            <audio
              controls
              src={playback}
              style={{ width: '100%' }}
              aria-label={copy.audio}
              onPlay={(event) => {
                // The visible player takes over from autoplay, so only one answer plays.
                generation.current++
                setWorking(false)
                if (player.current !== event.currentTarget) cancelSpeech()
                player.current = event.currentTarget
                speakingRef.current = true
                setSpeaking(true)
                voice.current?.muteRecording(true)
              }}
              onPause={(event) => {
                if (player.current !== event.currentTarget) return
                speakingRef.current = false
                setSpeaking(false)
                voice.current?.muteRecording(false)
              }}
              onEnded={(event) => {
                if (player.current !== event.currentTarget) return
                speakingRef.current = false
                setSpeaking(false)
                voice.current?.muteRecording(false)
              }}
            />
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const question = text.trim()
              if (question) {
                setText('')
                void consume(question, true)
              }
            }}
          >
            <Stack gap="xs">
              <Textarea
                label={copy.ask}
                placeholder={copy.placeholder}
                value={text}
                onChange={(event) => setText(event.currentTarget.value)}
                maxLength={4000}
                autosize
                minRows={2}
              />
              <Button
                type="submit"
                loading={busy}
                disabled={savingTask || !text.trim() || (speaking && liveState === 'off')}
              >
                {copy.send}
              </Button>
            </Stack>
          </form>
          <Button
            variant="subtle"
            color="gray"
            disabled={busy}
            onClick={() => {
              disable()
              history.current = []
              setMessages([])
              setDraft(null)
              setBriefing(null)
              setTaskAction(null)
              setError('')
            }}
          >
            Clear conversation
          </Button>
        </Stack>
      </Drawer>
      {draft && (
        <TransactionDrawer
          opened={review}
          onClose={() => {
            setReview(false)
            setDraft(null)
            setBriefing(null)
            setTaskAction(null)
          }}
          initialDraft={draft}
        />
      )}
    </>
  )
}
