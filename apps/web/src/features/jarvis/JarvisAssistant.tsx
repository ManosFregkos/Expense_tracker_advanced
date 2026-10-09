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
} from '@family-expense-tracker/shared'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { useHousehold } from '../households/HouseholdProvider'
import { TransactionDrawer } from '../transactions/TransactionDrawer'
import { parseJarvisCommand } from './commands'
import { blobToBase64, JarvisVoiceInput, voiceCapabilities } from './voice-input'
import { JarvisRealtimeVoice, type RealtimeState } from './realtime-voice'

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
  const [language, setLanguage] = useState('en-US')
  const languageRef = useRef(language)
  languageRef.current = language
  const [webSearch, setWebSearch] = useState(false)
  const webSearchRef = useRef(webSearch)
  webSearchRef.current = webSearch
  const [draft, setDraft] = useState<JarvisExpenseDraft | null>(null)
  const [taskAction, setTaskAction] = useState<JarvisTaskAction | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const savingTaskRef = useRef(false)
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
          utterance.lang = instant ? 'en-US' : languageRef.current
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
      } else setError('Automatic playback is unavailable. Use the audio player or read the answer.')
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
    setTaskAction(null)
    setReview(false)
    setPlayback(null)
    liveSources.current = []
    addMessage({ role: 'assistant', content: 'Goodbye sir' })
    void speak('Goodbye sir', true, token)
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
      })
      if (token !== generation.current || !alive.current) return
      addMessage({ role: 'assistant', content: result.reply, sources: result.sources })
      setDraft(result.draft)
      setTaskAction(result.taskAction ?? null)
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
      addMessage({ role: 'assistant', content: 'Hello Sir' })
      const token = generation.current
      await speak('Hello Sir', true, token)
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
        return (await api.jarvisTranscribe({ householdId, audio, mimeType })).text
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
          language: languageRef.current as 'en-US' | 'el-GR',
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
          messages: [
            ...history.current.slice(-18).map(({ role, content }) => ({ role, content })),
            { role: 'user', content: question },
          ],
        })
        if (token === generation.current && alive.current && awakeRef.current) {
          setDraft(result.draft)
          setTaskAction(result.taskAction ?? null)
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
        confirmation = `Task created: ${proposal.task.title}.`
      } else if (proposal.kind === 'complete') {
        const result = await api.completeTask({
          householdId,
          taskId: proposal.taskId,
          expectedVersion: proposal.expectedVersion,
        })
        confirmation = `Task completed: ${proposal.title}.${result.nextTaskId ? ' The next recurring occurrence was created.' : ''}`
      } else {
        await api.updateTask({
          householdId,
          taskId: proposal.taskId,
          expectedVersion: proposal.expectedVersion,
          task: proposal.task,
        })
        confirmation = `Task rescheduled: ${proposal.task.title}, ${proposal.task.dueDate ?? 'no due date'}${proposal.task.dueTime ? ` at ${proposal.task.dueTime}` : ''}.`
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
      if (startNow && realtime.current?.ready) await consume('Hello Jarvis', true)
      return
    }
    realtime.current?.stop()
    if (manual) setActive(true)
    await voice.current?.start(language, manual)
    if (startNow) await consume('Hello Jarvis', true)
  }
  const microphoneEnabled = mic !== 'off' || liveState !== 'off'
  const status =
    liveState === 'connecting'
      ? 'Connecting live voice'
      : busy
        ? 'Thinking'
        : speaking
          ? 'Speaking'
          : mic === 'transcribing'
            ? 'Transcribing'
            : !microphoneEnabled
              ? 'Microphone off'
              : awake
                ? 'Listening to you'
                : 'Waiting for Hello Jarvis'
  return (
    <>
      <Button
        variant={!microphoneEnabled ? 'light' : 'filled'}
        size="compact-sm"
        leftSection={<IconRobot size={18} />}
        onClick={() => setOpened(true)}
        aria-label={
          !microphoneEnabled ? 'Open Jarvis assistant' : `Open Jarvis assistant, ${status}`
        }
        className="jarvis-launcher"
      >
        <span className="jarvis-label">Jarvis{microphoneEnabled ? ' •' : ''}</span>
      </Button>
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title="Jarvis · Everyday assistant"
        closeButtonProps={{ 'aria-label': 'Close Jarvis' }}
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
              Turn microphone off
            </Button>
          </Group>
          <Text size="sm">
            Click Start live conversation to talk now, or Enable microphone once and allow access,
            then say “Hello Jarvis” to hear “Hello Sir”. Ask your question. Say “Jarvis stop” to
            hear “Goodbye sir”; Jarvis will wait for “Hello Jarvis” again.
          </Text>
          <Text size="xs" c="dimmed">
            AI-generated voice. Voice requires HTTPS, microphone permission, and this app in the
            foreground. Some TV browsers support text only. Closing this panel keeps listening
            enabled; use Turn microphone off to end listening.
          </Text>
          <Alert color="blue" title="Voice privacy">
            {caps.realtime
              ? 'Live voice streams microphone audio to OpenAI, including nearby speech while waiting for the wake phrase. You can interrupt a spoken answer. Requested household data is sent only through authorized app tools.'
              : caps.recognition
                ? 'Browser speech recognition may send audio to your browser’s speech service. Questions and requested household data are sent to OpenAI.'
                : 'In hands-free mode, spoken audio—including wake phrases and nearby speech—is sent to OpenAI for transcription. Use Record question for one recording at a time.'}
          </Alert>
          {!microphoneEnabled && (
            <Alert color="teal" title="One click is needed before Jarvis can hear you">
              Voice commands cannot turn on a disabled microphone. Enable it here first; listening
              continues when you close this panel while the app stays in the foreground.
            </Alert>
          )}
          {error && (
            <Alert color="red" role="alert" withCloseButton onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Select
            label="Voice input language"
            value={language}
            onChange={(value) => value && setLanguage(value)}
            disabled={microphoneEnabled}
            data={[
              { value: 'en-US', label: 'English' },
              { value: 'el-GR', label: 'Greek' },
            ]}
          />
          <Checkbox
            label="Use web search for current information"
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
                Start live conversation
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
              Enable microphone
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
              {mic === 'recording' && engine === 'cloud' ? 'Send recording' : 'Record question'}
            </Button>
            <Button
              variant="light"
              leftSection={<IconPlayerStop size={18} />}
              onClick={stopConversation}
              disabled={!awake && !busy && !speaking}
            >
              Jarvis stop
            </Button>
          </Group>
          {liveState !== 'off' && (
            <Text size="sm" c="dimmed">
              Live voice · speak naturally, pause for an answer, and interrupt to ask a follow-up.
              Say “Jarvis stop” to return to wake listening. Ask about tasks, transactions or
              balances; task changes require confirmation below.
            </Text>
          )}
          {playbackBlocked && (
            <Button onClick={() => void realtime.current?.playAudio()}>Play live audio</Button>
          )}
          {!caps.realtime && !caps.recognition && !caps.recording && (
            <Text size="sm">
              Microphone recording is unavailable in this browser. You can still type questions and
              play spoken answers.
            </Text>
          )}
          <Stack role="log" aria-label="Conversation with Jarvis" aria-live="polite" gap="sm">
            {messages.length === 0 && (
              <Paper p="md" withBorder>
                <Text fw={600}>What can I help with, Sir?</Text>
                <Text size="sm" c="dimmed">
                  Try “What can I cook with eggs and rice?”, “How much did our household spend this
                  month?”, “What tasks are overdue?”, or “Find supermarket transactions this week”.
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
                  {entry.role === 'user' ? 'You' : 'Jarvis'}
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
                        entry.content === 'Hello Sir' || entry.content === 'Goodbye sir',
                      )
                    }
                  >
                    Play answer
                  </Button>
                )}
              </Paper>
            ))}
          </Stack>
          {taskAction && (
            <Alert color="teal" title="Confirm task change">
              <Text fw={600}>
                {taskAction.kind === 'complete' ? taskAction.title : taskAction.task.title}
              </Text>
              <Text size="sm">
                {taskAction.kind === 'complete'
                  ? `Mark this task complete.${taskAction.recurring ? ' Completing it may create the next recurring occurrence.' : ''}`
                  : `${taskAction.kind === 'create' ? 'Create task' : `Reschedule from ${taskAction.previousDueDate ?? 'no due date'} ${taskAction.previousDueTime ?? ''}`} · ${taskAction.task.dueDate ?? 'No due date'} ${taskAction.task.dueTime ?? ''}${taskAction.kind === 'create' ? ` · Priority: ${taskAction.task.priority} · Assignee: ${taskAction.assigneeName ?? 'unassigned'} · List: ${taskAction.listName ?? 'none'}` : ''}`}
              </Text>
              <Text size="xs" c="dimmed">
                Dates and times use your household time zone. Nothing is saved until you confirm
                with the button.
              </Text>
              <Group mt="sm">
                <Button
                  loading={savingTask}
                  disabled={savingTask}
                  onClick={() => void confirmTaskChange()}
                >
                  Confirm task change
                </Button>
                <Button
                  variant="subtle"
                  disabled={savingTask}
                  onClick={() => {
                    setTaskAction(null)
                    const content = 'Task change cancelled. Nothing was saved.'
                    addMessage({ role: 'assistant', content })
                    realtime.current?.addAppResult(content)
                  }}
                >
                  Cancel task change
                </Button>
              </Group>
            </Alert>
          )}
          {draft && (
            <Alert color="teal" title="Expense ready for review">
              <Text size="sm">
                {draft.currency} {draft.amount} · {draft.description} · {draft.date}. Review the
                account and category, then Save to confirm.
              </Text>
              <Group mt="sm">
                <Button
                  onClick={() => {
                    disable()
                    setReview(true)
                  }}
                >
                  Review expense
                </Button>
                <Button variant="subtle" onClick={() => setDraft(null)}>
                  Discard
                </Button>
              </Group>
            </Alert>
          )}
          {playback && (
            <audio
              controls
              src={playback}
              style={{ width: '100%' }}
              aria-label="Latest Jarvis spoken answer"
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
                label="Ask Jarvis"
                placeholder="Type a question or a voice command…"
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
                Send question
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
            setTaskAction(null)
          }}
          initialDraft={draft}
        />
      )}
    </>
  )
}
