import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test/render'
import { JarvisAssistant } from './JarvisAssistant'
import { api } from '../../lib/callables'
import type { JarvisReply } from '@family-expense-tracker/shared'
import type { ReactNode, ButtonHTMLAttributes } from 'react'
import type * as Mantine from '@mantine/core'

// Controller tests use plain elements; the browser suite covers the real Mantine panel.
vi.mock('@mantine/core', async (importOriginal) => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>
  return {
    ...(await importOriginal<typeof Mantine>()),
    MantineProvider: Box,
    Drawer: ({
      opened,
      children,
      onClose,
    }: {
      opened: boolean
      children: ReactNode
      onClose(): void
    }) =>
      opened ? (
        <section>
          <button aria-label="Close Jarvis" onClick={onClose}>
            Close
          </button>
          {children}
        </section>
      ) : null,
    Button: ({
      children,
      onClick,
      disabled,
      type,
      'aria-label': label,
    }: ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type={type} onClick={onClick} disabled={disabled} aria-label={label}>
        {children}
      </button>
    ),
    Stack: Box,
    Group: Box,
    Paper: Box,
    Text: Box,
    Badge: Box,
    Alert: Box,
    Select: () => null,
    Checkbox: () => null,
    Textarea: () => null,
  }
})

const driver = vi.hoisted(() => ({
  transcript: (_text: string): void => undefined,
  stop: vi.fn(),
  householdId: 'h1',
  realtime: false,
  liveReady: false,
  liveTranscript: (_text: string): void => undefined,
  liveAnswer: (_text: string): void => undefined,
  liveRespond: vi.fn(),
  liveStop: vi.fn(),
  liveTool: (_question: string): Promise<JarvisReply> =>
    Promise.resolve({ reply: '', sources: [], draft: null }),
  liveAppResult: vi.fn(),
}))
vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: driver.householdId } }),
}))
vi.mock('../transactions/TransactionDrawer', () => ({ TransactionDrawer: () => null }))
vi.mock('../../lib/callables', () => ({
  api: {
    jarvisChat: vi.fn(),
    jarvisSpeak: vi.fn(),
    jarvisTranscribe: vi.fn(),
    jarvisStartRealtime: vi.fn(),
    createTask: vi.fn(),
    completeTask: vi.fn(),
    updateTask: vi.fn(),
  },
}))
vi.mock('./voice-input', () => ({
  voiceCapabilities: () => ({ recognition: true, recording: true, realtime: driver.realtime }),
  blobToBase64: vi.fn(),
  JarvisVoiceInput: class {
    constructor(
      private callbacks: {
        transcript(value: string): void
        state(value: string, engine?: string): void
      },
    ) {
      driver.transcript = callbacks.transcript
    }
    start() {
      this.callbacks.state('listening', 'browser')
      return Promise.resolve()
    }
    stop() {
      driver.stop()
      this.callbacks.state('off')
    }
    muteRecording() {}
    finishRecording() {}
  },
}))
vi.mock('./realtime-voice', () => ({
  JarvisRealtimeVoice: class {
    constructor(
      private callbacks: {
        connect(sdp: string): Promise<unknown>
        transcript(value: string): void
        answer(value: string): void
        tool(question: string): Promise<JarvisReply>
        state(value: string): void
      },
    ) {
      driver.liveTranscript = callbacks.transcript
      driver.liveAnswer = callbacks.answer
      driver.liveTool = callbacks.tool
    }
    get ready() {
      return driver.liveReady
    }
    async start() {
      this.callbacks.state('connecting')
      await this.callbacks.connect('v=0\r\noffer')
      driver.liveReady = true
      this.callbacks.state('listening')
    }
    stop() {
      driver.liveReady = false
      driver.liveStop()
      this.callbacks.state('off')
    }
    setAwake() {}
    interrupt() {}
    addAppResult(text: string) {
      driver.liveAppResult(text)
    }
    mute() {}
    playAudio() {
      return Promise.resolve()
    }
    respond(question?: string) {
      driver.liveRespond(question)
      this.callbacks.state('thinking')
    }
  },
}))
class Utterance {
  lang = ''
  voice = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}
const synthesis = {
  speak: vi.fn((utterance: Utterance) => queueMicrotask(() => utterance.onend?.())),
  cancel: vi.fn(),
  getVoices: () => [],
}
beforeEach(() => {
  vi.clearAllMocks()
  driver.householdId = 'h1'
  driver.realtime = false
  driver.liveReady = false
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  Object.assign(window, { speechSynthesis: synthesis })
  vi.mocked(api.jarvisSpeak).mockRejectedValue(new Error('Use local speech in tests'))
  vi.mocked(api.jarvisStartRealtime).mockResolvedValue({
    sdp: 'v=0\r\nanswer',
    model: 'gpt-realtime-2.1-mini',
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function openAndListen() {
  renderApp(<JarvisAssistant />)
  fireEvent.click(screen.getByLabelText('Open Jarvis assistant'))
  fireEvent.click(await screen.findByText('Enable microphone'))
  await screen.findByText('Waiting for Hello Jarvis')
}
const taskAction = {
  kind: 'create',
  clientRequestId: 'jarvis_test',
  task: {
    title: 'Buy milk',
    status: 'TODO',
    priority: 'NONE',
    tags: [],
    dueDate: '2026-10-10',
    dueTime: null,
  },
  assigneeName: null,
  listName: null,
} as const
const taskReply: JarvisReply = {
  reply: 'Review the task, Sir.',
  draft: null,
  sources: [],
  taskAction: { ...taskAction, task: { ...taskAction.task, tags: [] } },
}
describe('Jarvis conversation', () => {
  it('reports a confirmed save finishing after stop without restarting speech', async () => {
    vi.mocked(api.jarvisChat).mockResolvedValue(taskReply)
    let resolve: ((result: { taskId: string }) => void) | undefined
    vi.mocked(api.createTask).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    await openAndListen()
    act(() => driver.transcript('Hello Jarvis'))
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    act(() => driver.transcript('Create a task to buy milk'))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm task change' }))
    act(() => driver.transcript('Jarvis stop'))
    await screen.findByText('Goodbye sir')
    await act(async () => {
      resolve?.({ taskId: 'jarvis_test' })
      await Promise.resolve()
    })
    await screen.findByText('Task created: Buy milk.')
    expect(synthesis.speak).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Task created: Buy milk.' }),
    )
    expect(driver.liveAppResult).not.toHaveBeenCalled()
    await screen.findByText('Waiting for Hello Jarvis')
  })
  it('does not save a task until the user confirms, then prevents duplicate clicks and announces the actual result', async () => {
    vi.mocked(api.jarvisChat).mockResolvedValue(taskReply)
    let resolve: ((result: { taskId: string }) => void) | undefined
    vi.mocked(api.createTask).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    await openAndListen()
    act(() => driver.transcript('Hello Jarvis'))
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    act(() => driver.transcript('Create a task to buy milk today'))
    const confirm = await screen.findByRole('button', { name: 'Confirm task change' })
    expect(api.createTask).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(api.createTask).toHaveBeenCalledTimes(1)
    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'h1',
        clientRequestId: 'jarvis_test',
        title: 'Buy milk',
      }),
    )
    expect(screen.queryByText('Task created: Buy milk.')).not.toBeInTheDocument()
    await act(async () => {
      resolve?.({ taskId: 'jarvis_test' })
      await Promise.resolve()
    })
    await screen.findByText('Task created: Buy milk.')
    expect(screen.queryByRole('button', { name: 'Confirm task change' })).not.toBeInTheDocument()
    expect(driver.liveAppResult).toHaveBeenCalledWith('Task created: Buy milk.')
  })
  it('cancels a live task proposal without writing and retains a failed confirmation for retry', async () => {
    driver.realtime = true
    vi.mocked(api.jarvisChat).mockResolvedValue({
      ...taskReply,
      taskAction: {
        kind: 'complete',
        taskId: 't1',
        title: 'Buy milk',
        expectedVersion: 4,
        recurring: true,
      },
    })
    vi.mocked(api.completeTask).mockRejectedValueOnce(
      new Error('Task changed. Ask for a fresh preview.'),
    )
    renderApp(<JarvisAssistant />)
    fireEvent.click(screen.getByLabelText('Open Jarvis assistant'))
    fireEvent.click(screen.getByText('Start live conversation'))
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    await act(async () => {
      await driver.liveTool('Complete Buy milk')
    })
    await screen.findByRole('button', { name: 'Confirm task change' })
    expect(api.completeTask).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel task change' }))
    await screen.findByText('Task change cancelled. Nothing was saved.')
    expect(api.completeTask).not.toHaveBeenCalled()
    await act(async () => {
      await driver.liveTool('Complete Buy milk')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm task change' }))
    await waitFor(() =>
      expect(api.completeTask).toHaveBeenCalledWith({
        householdId: 'h1',
        taskId: 't1',
        expectedVersion: 4,
      }),
    )
    await screen.findByRole('button', { name: 'Confirm task change' })
    expect(screen.queryByText('Task completed: Buy milk.')).not.toBeInTheDocument()
    vi.mocked(api.completeTask).mockResolvedValueOnce({ taskId: 't1', nextTaskId: 't2' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm task change' }))
    await screen.findByText('Task completed: Buy milk. The next recurring occurrence was created.')
    expect(driver.liveReady).toBe(true)
  })

  it('starts live conversation with one click and streams follow-ups without separate chat or TTS calls', async () => {
    driver.realtime = true
    renderApp(<JarvisAssistant />)
    fireEvent.click(screen.getByLabelText('Open Jarvis assistant'))
    expect(
      screen.getByText(/Voice commands cannot turn on a disabled microphone/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText('Start live conversation'))
    await screen.findByText('Hello Sir')
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    expect(api.jarvisStartRealtime).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'h1', sdp: 'v=0\r\noffer' }),
    )
    act(() => driver.liveTranscript('What can I cook?'))
    expect(driver.liveRespond).toHaveBeenCalledWith(undefined)
    act(() => driver.liveAnswer('Try egg fried rice, Sir.'))
    await screen.findByText('Try egg fried rice, Sir.')
    act(() => driver.liveTranscript('Can I add vegetables?'))
    expect(driver.liveRespond).toHaveBeenCalledTimes(2)
    expect(api.jarvisChat).not.toHaveBeenCalled()
    expect(api.jarvisSpeak).not.toHaveBeenCalled()
  })
  it('opens the panel on a Greek wake phrase and keeps live wake listening after stop', async () => {
    driver.realtime = true
    await openAndListen()
    fireEvent.click(screen.getByLabelText('Close Jarvis'))
    expect(screen.queryByText('Waiting for Hello Jarvis')).not.toBeInTheDocument()
    act(() => driver.liveTranscript('Χέλο Τζάρβις'))
    await screen.findByText('Hello Sir')
    act(() => driver.liveTranscript('Τζάρβις στοπ'))
    await screen.findByText('Goodbye sir')
    await waitFor(() => expect(screen.getByText('Waiting for Hello Jarvis')).toBeInTheDocument())
    expect(driver.liveReady).toBe(true)
    act(() => driver.liveTranscript('Hello Jarvis'))
    await waitFor(() => expect(screen.getAllByText('Hello Sir')).toHaveLength(2))
    fireEvent.click(screen.getByText('Turn microphone off'))
    expect(driver.liveReady).toBe(false)
    await screen.findByText('Microphone off')
  })
  it('lets the visible audio controls take over autoplay and stops that player on the stop phrase', async () => {
    class MockAudio {
      static latest: MockAudio
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      play = vi.fn().mockResolvedValue(undefined)
      pause = vi.fn()
      constructor(public src: string) {
        MockAudio.latest = this
      }
    }
    vi.stubGlobal('Audio', MockAudio)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.mocked(api.jarvisChat).mockResolvedValue({
      reply: 'An answer, Sir.',
      draft: null,
      sources: [],
    })
    vi.mocked(api.jarvisSpeak).mockResolvedValue({ audio: 'AAAA', mimeType: 'audio/mpeg' })
    await openAndListen()
    act(() => driver.transcript('Hello Jarvis'))
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    act(() => driver.transcript('A question'))
    const audio = await screen.findByLabelText('Latest Jarvis spoken answer')
    fireEvent.play(audio)
    expect(MockAudio.latest.pause).toHaveBeenCalledOnce()
    act(() => driver.transcript('Jarvis stop'))
    await screen.findByText('Goodbye sir')
    expect(pause).toHaveBeenCalled()
    expect(screen.queryByLabelText('Latest Jarvis spoken answer')).not.toBeInTheDocument()
  })
  it('speaks the greeting, answers, then speaks goodbye and waits for another wake phrase', async () => {
    vi.mocked(api.jarvisChat).mockResolvedValue({
      reply: 'Make egg fried rice, Sir.',
      draft: null,
      sources: [],
    })
    await openAndListen()
    act(() => driver.transcript('What can I cook?'))
    expect(api.jarvisChat).not.toHaveBeenCalled()
    act(() => driver.transcript('Hello Jarvis'))
    await screen.findByText('Hello Sir')
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    expect(synthesis.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello Sir' }))
    act(() => driver.transcript('What can I cook with rice?'))
    await screen.findByText('Make egg fried rice, Sir.')
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    act(() => driver.transcript('Jarvis stop'))
    await screen.findByText('Goodbye sir')
    await waitFor(() => expect(screen.getByText('Waiting for Hello Jarvis')).toBeInTheDocument())
    expect(synthesis.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Goodbye sir' }))
    expect(driver.stop).not.toHaveBeenCalled()
    act(() => driver.transcript('What is for dinner?'))
    expect(api.jarvisChat).toHaveBeenCalledTimes(1)
    act(() => driver.transcript('Hello Jarvis'))
    await waitFor(() => expect(screen.getAllByText('Hello Sir')).toHaveLength(2))
  })
  it('discards late AI responses after Jarvis stop', async () => {
    let answer: ((reply: JarvisReply) => void) | undefined
    vi.mocked(api.jarvisChat).mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    )
    await openAndListen()
    act(() => driver.transcript('Hello Jarvis'))
    await waitFor(() => expect(screen.getByText('Listening to you')).toBeInTheDocument())
    act(() => driver.transcript('Tell me about rice'))
    await screen.findByText('Thinking')
    act(() => driver.transcript('Jarvis stop'))
    await act(async () => {
      answer?.({ reply: 'A late response', draft: null, sources: [] })
      await Promise.resolve()
    })
    expect(screen.queryByText('A late response')).not.toBeInTheDocument()
    expect(api.jarvisSpeak).not.toHaveBeenCalled()
    await screen.findByText('Waiting for Hello Jarvis')
  })
  it('releases the microphone and clears private history when the household changes', async () => {
    const view = renderApp(<JarvisAssistant />)
    fireEvent.click(screen.getByLabelText('Open Jarvis assistant'))
    fireEvent.click(await screen.findByText('Enable microphone'))
    act(() => driver.transcript('Hello Jarvis'))
    await screen.findByText('Hello Sir')
    driver.householdId = 'h2'
    view.rerender(<JarvisAssistant />)
    expect(driver.stop).toHaveBeenCalled()
    expect(screen.queryByText('Hello Sir')).not.toBeInTheDocument()
  })
})
