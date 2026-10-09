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
    Drawer: ({ opened, children }: { opened: boolean; children: ReactNode }) =>
      opened ? <section>{children}</section> : null,
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
}))
vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: driver.householdId } }),
}))
vi.mock('../transactions/TransactionDrawer', () => ({ TransactionDrawer: () => null }))
vi.mock('../../lib/callables', () => ({
  api: { jarvisChat: vi.fn(), jarvisSpeak: vi.fn(), jarvisTranscribe: vi.fn() },
}))
vi.mock('./voice-input', () => ({
  voiceCapabilities: () => ({ recognition: true, recording: true }),
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
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  Object.assign(window, { speechSynthesis: synthesis })
  vi.mocked(api.jarvisSpeak).mockRejectedValue(new Error('Use local speech in tests'))
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
describe('Jarvis conversation', () => {
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
