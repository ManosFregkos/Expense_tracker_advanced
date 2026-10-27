import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@mantine/core'
import { IconMicrophone, IconMicrophoneOff, IconSparkles } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { FirebaseError } from 'firebase/app'
import type { JarvisReply } from '@family-expense-tracker/shared'
import { useHousehold } from '../households/HouseholdProvider'
import { useAccounts } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { accountKeys, analyticsKeys, taskKeys, transactionKeys } from '../../lib/query-keys'
import { parseVoiceCommand } from './voice'
import { useJarvisVoice } from './useJarvisVoice'
import { audioToBase64, useCommandRecording } from './useCommandRecording'
import { visibleTransactionIds } from './visible-transactions'

function jarvisError(error: unknown): string {
  if (
    error instanceof FirebaseError &&
    error.code.startsWith('functions/') &&
    error.code !== 'functions/internal'
  )
    return error.message
  return friendlyError(error)
}

type PendingAction = NonNullable<JarvisReply['action']>
interface Message {
  id: string
  role: 'You' | 'Jarvis'
  text: string
}
const confirmation =
  /^(?:yes|yes please|confirm|confirm deletion|confirm delete|save it|delete it|ναι|επιβεβαίωση|επιβεβαιώνω)[.!?\s]*$/i
const cancellation = /^(?:no|cancel|never mind|nevermind|όχι|ακύρωση)[.!?\s]*$/i

export function JarvisAssistant() {
  const { household } = useHousehold()
  const accounts = useAccounts()
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voiceFeedback, setVoiceFeedback] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [language, setLanguage] = useState(() =>
    localStorage.getItem('jarvis.language') === 'el-GR' ? 'el-GR' : 'en-US',
  )
  const [speakReplies, setSpeakReplies] = useState(true)
  const [confirmAdditions, setConfirmAdditions] = useState(false)
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(() =>
    localStorage.getItem(`jarvis.account.${household!.id}`),
  )
  const sessionId = useRef(crypto.randomUUID())
  const epoch = useRef(0)
  const active = useRef(false)
  const speaking = useRef(false)
  const speechGuardUntil = useRef(0)
  const busyRef = useRef(false)
  const pendingRef = useRef<PendingAction | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const availableAccounts = (accounts.data ?? []).filter((account) => !account.isArchived)
  const selectedAccount = availableAccounts.some((account) => account.id === defaultAccountId)
    ? defaultAccountId
    : null

  const append = (role: Message['role'], text: string) => {
    setMessages((previous) => [...previous.slice(-59), { id: crypto.randomUUID(), role, text }])
  }
  const setAction = (action: PendingAction | null) => {
    pendingRef.current = action
    setPending(action)
  }
  const silence = () => {
    if (speaking.current) speechGuardUntil.current = Date.now() + 1200
    speaking.current = false
    window.speechSynthesis?.cancel()
  }
  const speak = (text: string) => {
    silence()
    if (!speakReplies || !window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = 1
    speaking.current = true
    const ended = () => {
      speaking.current = false
      speechGuardUntil.current = Date.now() + 1200
    }
    utterance.onend = ended
    utterance.onerror = ended
    window.speechSynthesis.speak(utterance)
  }
  const invalidate = async () => {
    await Promise.all(
      [
        transactionKeys.all(household!.id),
        accountKeys.all(household!.id),
        analyticsKeys.monthly(household!.id),
        taskKeys.all(household!.id),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
  }
  const execute = async (
    action: PendingAction,
    decision: 'CONFIRM' | 'CANCEL',
    version: number,
  ) => {
    const result = await api.jarvisAction({
      householdId: household!.id,
      sessionId: sessionId.current,
      requestId: action.requestId,
      decision,
    })
    // Refresh even if the drawer was closed while an already-sent commit finished.
    if (result.status === 'COMPLETED') await invalidate()
    if (epoch.current !== version) return
    setAction(null)
    append('Jarvis', result.message)
    speak(result.message)
  }
  const decide = async (decision: 'CONFIRM' | 'CANCEL') => {
    const action = pendingRef.current
    if (!action || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    silence()
    const version = epoch.current
    try {
      await execute(action, decision, version)
    } catch (cause) {
      if (epoch.current === version) setError(jarvisError(cause))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const close = () => {
    recording.cancel()
    active.current = false
    setOpened(false)
    setVoiceFeedback('')
    silence()
    epoch.current += 1
    const action = pendingRef.current
    setAction(null)
    // A sent mutation may already have committed; keep the UI locked until it settles.
    if (!busyRef.current && action) {
      void api
        .jarvisAction({
          householdId: household!.id,
          sessionId: sessionId.current,
          requestId: action.requestId,
          decision: 'CANCEL',
        })
        .catch(() => undefined)
    }
  }
  const submit = async (text: string) => {
    const message = text.trim()
    if (!message || busyRef.current || recording.busy || !household) return
    if (pendingRef.current && confirmation.test(message)) {
      await decide('CONFIRM')
      return
    }
    if (pendingRef.current && cancellation.test(message)) {
      await decide('CANCEL')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    setDraft('')
    silence()
    const version = epoch.current
    append('You', message)
    try {
      if (pendingRef.current) {
        await api.jarvisAction({
          householdId: household.id,
          sessionId: sessionId.current,
          requestId: pendingRef.current.requestId,
          decision: 'CANCEL',
        })
        setAction(null)
      }
      if (epoch.current !== version) return
      if (!navigator.onLine) {
        setError('Jarvis needs an internet connection.')
        return
      }
      const visibleIds = visibleTransactionIds(queryClient, household.id)
      const result = await api.jarvisChat({
        householdId: household.id,
        sessionId: sessionId.current,
        requestId: crypto.randomUUID(),
        message,
        language: language === 'el-GR' ? 'el-GR' : 'en-US',
        defaultAccountId: selectedAccount,
        ...(visibleIds ? { visibleTransactionIds: visibleIds } : {}),
      })
      if (epoch.current !== version) {
        if (result.action)
          await api.jarvisAction({
            householdId: household.id,
            sessionId: sessionId.current,
            requestId: result.action.requestId,
            decision: 'CANCEL',
          })
        return
      }
      if (result.action) {
        setAction(result.action)
        if (result.action.kind !== 'DELETE_TRANSACTION' && !confirmAdditions) {
          await execute(result.action, 'CONFIRM', version)
        } else {
          append('Jarvis', result.reply)
          speak(
            `${result.reply}. ${language === 'el-GR' ? 'Πες ναι για επιβεβαίωση ή ακύρωση.' : 'Say confirm or cancel.'}`,
          )
        }
      } else {
        append('Jarvis', result.reply)
        speak(result.reply)
      }
    } catch (cause) {
      if (epoch.current === version) setError(jarvisError(cause))
    } finally {
      // Close/stop invalidates responses, but must always release the in-flight lock.
      busyRef.current = false
      setBusy(false)
    }
  }
  const recording = useCommandRecording(
    async (audio, isCurrent) => {
      const version = epoch.current
      if (!['audio/webm', 'audio/mp4', 'audio/wav'].includes(audio.type))
        throw new Error(
          'This recording format is unsupported. Try another browser or type your command.',
        )
      const audioBase64 = await audioToBase64(audio)
      if (version !== epoch.current || !isCurrent()) return
      const result = await api.jarvisTranscribe({
        householdId: household!.id,
        language: language === 'el-GR' ? 'el-GR' : 'en-US',
        mimeType: audio.type as 'audio/webm' | 'audio/mp4' | 'audio/wav',
        audioBase64,
      })
      if (version !== epoch.current || !isCurrent()) return
      const command = parseVoiceCommand(result.text, false)
      setDraft(command.type === 'wake' && command.message ? command.message : result.text)
      setVoiceFeedback(
        'Recording transcribed. Review the words, amount, and currency below, then press Send.',
      )
    },
    (cause) =>
      setError(
        cause instanceof FirebaseError
          ? jarvisError(cause)
          : cause instanceof Error
            ? cause.message
            : 'Could not transcribe the recording.',
      ),
  )
  const voice = useJarvisVoice(language, (text) => {
    if (recording.busy) return
    const command = parseVoiceCommand(
      text,
      active.current,
      speaking.current || Date.now() < speechGuardUntil.current,
    )
    if (command.type === 'stop') {
      close()
      return
    }
    if (command.type === 'uncertain-wake') {
      setVoiceFeedback(
        `I heard “${text}”. If you meant Jarvis, say “Hey Jarvis” again, or ask your question directly while this panel is open.`,
      )
      return
    }
    if (command.type === 'wake') {
      active.current = true
      setOpened(true)
      if (command.message) {
        setVoiceFeedback('')
        void submit(command.message)
      } else if (!busyRef.current) {
        const reply =
          language === 'el-GR' ? 'Είμαι εδώ. Τι θα ήθελες;' : 'I’m here. What would you like to do?'
        setVoiceFeedback(reply)
        speak(reply)
      }
    } else if (command.type === 'message') {
      setVoiceFeedback('')
      void submit(command.message)
    }
  })

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, busy])
  useEffect(
    () => () => {
      epoch.current += 1
      window.speechSynthesis?.cancel()
    },
    [],
  )

  return (
    <>
      <Button
        variant={voice.enabled ? 'light' : 'subtle'}
        size="compact-sm"
        leftSection={<IconSparkles size={17} />}
        aria-label="Open Jarvis"
        onClick={() => {
          active.current = true
          setOpened(true)
        }}
      >
        Jarvis{voice.enabled ? ' •' : ''}
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="md"
        styles={{
          body: {
            height: 'calc(100dvh - 76px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
        title={
          <Group gap="xs">
            <IconSparkles />
            <Text fw={700}>Jarvis</Text>
            <Badge variant="light" color={voice.enabled ? 'teal' : 'gray'}>
              {recording.stage === 'recording'
                ? 'Recording'
                : recording.stage === 'transcribing'
                  ? 'Transcribing'
                  : busy
                    ? 'Thinking'
                    : voice.listening
                      ? 'Listening'
                      : voice.enabled
                        ? 'Connecting'
                        : 'Text mode'}
            </Badge>
          </Group>
        }
      >
        <Stack gap="xs" h="100%" style={{ minHeight: 0 }}>
          <Paper withBorder p="sm" radius="md" style={{ flexShrink: 0 }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Hands-free voice
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  disabled={!voice.supported || recording.busy}
                  leftSection={
                    voice.enabled ? <IconMicrophoneOff size={15} /> : <IconMicrophone size={15} />
                  }
                  onClick={voice.enabled ? voice.stop : voice.start}
                >
                  {voice.enabled ? 'Turn microphone off' : 'Enable voice'}
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                Say “Hey Jarvis” to wake, or ask directly while this panel is open. Say “Jarvis
                stop” to close.
              </Text>
              <Text size="xs" c="dimmed">
                Browser speech runs online. Record command sends audio to OpenAI (30s max); review
                the draft before Send.
              </Text>
              {!voice.supported && (
                <Text size="xs" c="orange">
                  This browser does not support voice recognition. Type your request below.
                </Text>
              )}
            </Stack>
          </Paper>
          {(error || voice.error) && (
            <Alert
              color="red"
              role="alert"
              style={{ flexShrink: 0, maxHeight: '25dvh', overflowY: 'auto' }}
            >
              {error || voice.error}
            </Alert>
          )}
          {(voice.interimTranscript || voice.lastTranscript || voice.notice || voiceFeedback) && (
            <Paper
              p="xs"
              bg="teal.0"
              radius="md"
              style={{ flexShrink: 0, maxHeight: '16dvh', overflowY: 'auto' }}
              aria-label="Voice feedback"
            >
              {voice.interimTranscript ? (
                <Text size="sm">Hearing: {voice.interimTranscript}</Text>
              ) : voice.lastTranscript ? (
                <Text size="sm">Heard: {voice.lastTranscript}</Text>
              ) : null}
              {voiceFeedback && (
                <Text size="sm" role="status">
                  {voiceFeedback}
                </Text>
              )}
              {voice.notice && (
                <Text size="xs" role="status">
                  {voice.notice}
                </Text>
              )}
            </Paper>
          )}
          <details style={{ flexShrink: 0, maxHeight: '35dvh', overflowY: 'auto' }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Voice settings
            </summary>
            <Stack gap="sm" pt="sm">
              <Group grow align="start">
                <Select
                  label="Voice language"
                  value={language}
                  allowDeselect={false}
                  data={[
                    { value: 'en-US', label: 'English' },
                    { value: 'el-GR', label: 'Ελληνικά' },
                  ]}
                  onChange={(value) => {
                    if (value) {
                      voice.stop()
                      silence()
                      setLanguage(value)
                      localStorage.setItem('jarvis.language', value)
                    }
                  }}
                />
                <Select
                  label="Default account"
                  placeholder="Ask me each time"
                  clearable
                  value={selectedAccount}
                  data={availableAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.name} (${account.currency})`,
                  }))}
                  onChange={(value) => {
                    setDefaultAccountId(value)
                    const key = `jarvis.account.${household!.id}`
                    if (value) localStorage.setItem(key, value)
                    else localStorage.removeItem(key)
                  }}
                />
              </Group>
              <Switch
                label="Read replies aloud"
                checked={speakReplies}
                onChange={(event) => {
                  setSpeakReplies(event.currentTarget.checked)
                  silence()
                }}
              />
              <Switch
                label="Confirm additions before saving"
                description="Transaction deletions always need confirmation."
                checked={confirmAdditions}
                onChange={(event) => setConfirmAdditions(event.currentTarget.checked)}
              />
            </Stack>
          </details>
          <ScrollArea
            style={{ flex: '1 1 0', minHeight: 0 }}
            viewportRef={viewport}
            type="auto"
            aria-label="Jarvis conversation"
          >
            <Stack gap="sm" role="log" aria-live="polite" aria-relevant="additions">
              {!messages.length && (
                <Paper bg="gray.0" p="md" radius="md">
                  <Text size="sm">
                    Try “Add 30 euro supermarket as an expense”, “Add income 1500 euro salary”,
                    “Delete yesterday’s 30 euro supermarket transaction”, or “Add buy milk to my
                    shopping list”.
                  </Text>
                </Paper>
              )}
              {messages.map((message) => (
                <Paper
                  key={message.id}
                  p="sm"
                  radius="md"
                  withBorder
                  bg={message.role === 'You' ? 'teal.0' : undefined}
                >
                  <Text size="xs" fw={700} c="dimmed">
                    {message.role}
                  </Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {message.text}
                  </Text>
                </Paper>
              ))}
              {busy && (
                <Text size="sm" c="dimmed" role="status">
                  Jarvis is working…
                </Text>
              )}
            </Stack>
          </ScrollArea>
          {pending && (
            <Paper
              withBorder
              p="sm"
              radius="md"
              style={{ flexShrink: 0, maxHeight: '28dvh', overflowY: 'auto' }}
            >
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  {pending.kind === 'DELETE_TRANSACTION'
                    ? 'Confirm transaction deletion'
                    : 'Confirm addition'}
                </Text>
                <Text size="sm">{pending.summary}</Text>
                <Text size="xs" c="dimmed">
                  Say “confirm” or “cancel”. Expires in 10 minutes.
                </Text>
                <Group>
                  <Button
                    size="sm"
                    color={pending.kind === 'DELETE_TRANSACTION' ? 'red' : 'teal'}
                    disabled={busy}
                    onClick={() => void decide('CONFIRM')}
                  >
                    {pending.kind === 'DELETE_TRANSACTION' ? 'Confirm deletion' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busy}
                    onClick={() => void decide('CANCEL')}
                  >
                    Cancel
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}
          <form
            style={{ flexShrink: 0 }}
            onSubmit={(event) => {
              event.preventDefault()
              void submit(draft)
            }}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <Button
                  size="compact-xs"
                  variant="light"
                  disabled={
                    busy ||
                    !recording.supported ||
                    recording.stage === 'requesting' ||
                    recording.stage === 'transcribing'
                  }
                  onClick={() => {
                    if (recording.stage === 'recording') recording.finish()
                    else {
                      voice.stop()
                      silence()
                      setError('')
                      setVoiceFeedback('')
                      void recording.start()
                    }
                  }}
                >
                  {recording.stage === 'recording'
                    ? 'Stop recording'
                    : recording.stage === 'transcribing'
                      ? 'Transcribing…'
                      : recording.stage === 'requesting'
                        ? 'Waiting for microphone…'
                        : 'Record command'}
                </Button>
                {recording.busy && (
                  <Button size="compact-xs" variant="subtle" onClick={recording.cancel}>
                    Cancel recording
                  </Button>
                )}
              </Group>
              <Textarea
                aria-label="Message Jarvis"
                placeholder="Ask Jarvis…"
                autosize
                minRows={1}
                maxRows={3}
                maxLength={2000}
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submit(draft)
                  }
                }}
              />
              <Group justify="space-between">
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={busy || recording.busy}
                  onClick={() => {
                    silence()
                    const action = pendingRef.current
                    if (action)
                      void api
                        .jarvisAction({
                          householdId: household!.id,
                          sessionId: sessionId.current,
                          requestId: action.requestId,
                          decision: 'CANCEL',
                        })
                        .catch(() => undefined)
                    setAction(null)
                    sessionId.current = crypto.randomUUID()
                    setMessages([])
                    setError('')
                  }}
                >
                  New conversation
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={busy}
                  disabled={!draft.trim() || recording.busy}
                >
                  Send
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Drawer>
    </>
  )
}
