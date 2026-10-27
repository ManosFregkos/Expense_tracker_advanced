import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/callables'
import { JarvisAssistant } from './JarvisAssistant'
import type { JarvisReply } from '@family-expense-tracker/shared'
import type { ChangeEventHandler, ReactNode, Ref } from 'react'
import type * as MantineCore from '@mantine/core'

// Browser E2E covers the real drawer. Keep jsdom tests focused on command orchestration.
vi.mock('@mantine/core', async (importOriginal) => ({
  ...(await importOriginal<typeof MantineCore>()),
  Drawer: ({ opened, children }: { opened: boolean; children: ReactNode }) =>
    opened ? <section>{children}</section> : null,
  ScrollArea: ({
    children,
    viewportRef,
  }: {
    children: ReactNode
    viewportRef: Ref<HTMLDivElement>
  }) => <div ref={viewportRef}>{children}</div>,
  Select: ({ label }: { label: string }) => (
    <label>
      {label}
      <select aria-label={label}>
        <option>Test account</option>
      </select>
    </label>
  ),
  Switch: ({
    label,
    checked,
    onChange,
  }: {
    label: string
    checked: boolean
    onChange: ChangeEventHandler<HTMLInputElement>
  }) => (
    <label>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  ),
}))

function renderAssistant() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <QueryClientProvider client={client}>
        <JarvisAssistant />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

const voice = vi.hoisted(() => ({ handler: (_text: string) => undefined as void }))
const clip = vi.hoisted(() => ({
  handler: (_audio: Blob, _isCurrent: () => boolean): Promise<void> => Promise.resolve(),
}))
vi.mock('./useCommandRecording', () => ({
  audioToBase64: vi.fn(async () => 'dGVzdA=='),
  useCommandRecording: (handler: typeof clip.handler) => {
    clip.handler = handler
    return {
      stage: 'idle',
      busy: false,
      supported: true,
      start: vi.fn(),
      finish: vi.fn(),
      cancel: vi.fn(),
    }
  },
}))
vi.mock('./useJarvisVoice', () => ({
  useJarvisVoice: (_language: string, handler: (text: string) => void) => {
    voice.handler = handler
    return {
      enabled: true,
      listening: true,
      error: '',
      supported: true,
      start: vi.fn(),
      stop: vi.fn(),
    }
  },
}))
vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({
    household: { id: 'h1', defaultCurrency: 'EUR', timeZone: 'Europe/Athens' },
  }),
}))
vi.mock('../../hooks/useHouseholdData', () => ({
  useAccounts: () => ({ data: [{ id: 'a1', name: 'Cash', currency: 'EUR', isArchived: false }] }),
}))
vi.mock('../../lib/callables', () => ({
  api: { jarvisChat: vi.fn(), jarvisAction: vi.fn(), jarvisTranscribe: vi.fn() },
}))
const pending = (kind: NonNullable<JarvisReply['action']>['kind']): JarvisReply => ({
  reply: 'Ready to save: €30 Supermarket',
  action: {
    requestId: crypto.randomUUID(),
    kind,
    summary: '€30 Supermarket · Cash · 2026-10-27',
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  },
})
function send(text: string) {
  fireEvent.change(screen.getByLabelText('Message Jarvis'), { target: { value: text } })
  fireEvent.click(screen.getByText('Send'))
}
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  vi.mocked(api.jarvisAction).mockResolvedValue({
    status: 'COMPLETED',
    message: 'Saved successfully',
    entityId: 't1',
  })
})
describe('Jarvis panel workflow', () => {
  it('puts a recorded transcript in the editable draft without automatically creating a transaction', async () => {
    vi.mocked(api.jarvisTranscribe).mockResolvedValue({ text: 'Add 30 euros supermarket' })
    vi.mocked(api.jarvisChat).mockResolvedValue({ reply: 'Which account?', action: null })
    renderAssistant()
    fireEvent.click(screen.getByLabelText('Open Jarvis'))
    await act(async () => clip.handler(new Blob(['audio'], { type: 'audio/webm' }), () => true))
    expect(screen.getByLabelText('Message Jarvis')).toHaveValue('Add 30 euros supermarket')
    expect(api.jarvisChat).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Send'))
    await waitFor(() =>
      expect(api.jarvisChat).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Add 30 euros supermarket' }),
      ),
    )
  })
  it('explains a misheard standalone greeting locally without submitting it to GPT', () => {
    renderAssistant()
    fireEvent.click(screen.getByLabelText('Open Jarvis'))
    act(() => voice.handler("hey Debbie's"))
    expect(screen.getByText(/If you meant Jarvis/)).toBeInTheDocument()
    expect(api.jarvisChat).not.toHaveBeenCalled()
  })
  it('acknowledges the wake phrase alone without making an unnecessary GPT call', async () => {
    renderAssistant()
    act(() => voice.handler('Hey Jarvis'))
    expect(await screen.findByText('I’m here. What would you like to do?')).toBeInTheDocument()
    expect(api.jarvisChat).not.toHaveBeenCalled()
  })
  it('opens on wake, handles an everyday answer, and closes on the stop phrase', async () => {
    vi.mocked(api.jarvisChat).mockResolvedValue({ reply: 'Hello there', action: null })
    renderAssistant()
    act(() => voice.handler('background conversation'))
    expect(api.jarvisChat).not.toHaveBeenCalled()
    await act(async () => voice.handler('Hey Jarvis why is the sky blue'))
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(api.jarvisChat).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'why is the sky blue' }),
    )
    expect(api.jarvisAction).not.toHaveBeenCalled()
    act(() => voice.handler('Jarvis stop'))
    await waitFor(() => expect(screen.queryByLabelText('Message Jarvis')).not.toBeInTheDocument())
  })
  it('saves clear additions but requires a separate confirmation for deletions', async () => {
    vi.mocked(api.jarvisChat)
      .mockResolvedValueOnce(pending('CREATE_TRANSACTION'))
      .mockResolvedValueOnce(pending('DELETE_TRANSACTION'))
    renderAssistant()
    fireEvent.click(screen.getByLabelText('Open Jarvis'))
    send('Add 30 euro supermarket')
    await screen.findByText('Saved successfully')
    expect(api.jarvisAction).toHaveBeenCalledTimes(1)
    send('Delete the transaction')
    const confirm = await screen.findByText('Confirm deletion')
    expect(api.jarvisAction).toHaveBeenCalledTimes(1)
    fireEvent.click(confirm)
    await waitFor(() => expect(api.jarvisAction).toHaveBeenCalledTimes(2))
  })
  it('supports previews for additions and voice cancellation', async () => {
    vi.mocked(api.jarvisChat).mockResolvedValue(pending('CREATE_TASK'))
    vi.mocked(api.jarvisAction).mockResolvedValue({
      status: 'CANCELLED',
      message: 'Action cancelled. Nothing changed.',
    })
    renderAssistant()
    fireEvent.click(screen.getByLabelText('Open Jarvis'))
    fireEvent.click(screen.getByLabelText('Confirm additions before saving'))
    send('Add buy milk')
    await screen.findByText('Confirm addition')
    expect(api.jarvisAction).not.toHaveBeenCalled()
    act(() => voice.handler('cancel'))
    await screen.findByText('Action cancelled. Nothing changed.')
    expect(api.jarvisAction).toHaveBeenCalledWith(expect.objectContaining({ decision: 'CANCEL' }))
  })
  it('does not auto-save a proposal returned after the stop phrase', async () => {
    let resolve!: (reply: JarvisReply) => void
    vi.mocked(api.jarvisChat).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    vi.mocked(api.jarvisAction).mockResolvedValue({ status: 'CANCELLED', message: 'Cancelled' })
    renderAssistant()
    act(() => voice.handler('Hey Jarvis add 30 euro supermarket'))
    await waitFor(() => expect(api.jarvisChat).toHaveBeenCalled())
    act(() => voice.handler('Jarvis stop'))
    await act(async () => resolve(pending('CREATE_TRANSACTION')))
    await waitFor(() =>
      expect(api.jarvisAction).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'CANCEL' }),
      ),
    )
    expect(
      vi.mocked(api.jarvisAction).mock.calls.every(([input]) => input.decision === 'CANCEL'),
    ).toBe(true)
  })
})
