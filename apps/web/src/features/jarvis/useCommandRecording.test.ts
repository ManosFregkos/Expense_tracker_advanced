import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommandRecording } from './useCommandRecording'

class Recorder {
  static latest: Recorder
  static isTypeSupported = (value: string) => value.startsWith('audio/webm')
  state = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    Recorder.latest = this
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['recorded speech'], { type: this.mimeType }) })
    this.onstop?.()
  }
}
const stopTrack = vi.fn()
const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
beforeEach(() => {
  stopTrack.mockClear()
  vi.stubGlobal('MediaRecorder', Recorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})
describe('reviewable recorded commands', () => {
  it('records a clip and delivers it for transcription after Stop', async () => {
    const transcribe = vi.fn(async () => undefined)
    const { result } = renderHook(() => useCommandRecording(transcribe, vi.fn()))
    await act(async () => result.current.start())
    expect(result.current.stage).toBe('recording')
    expect(transcribe).not.toHaveBeenCalled()
    await act(async () => result.current.finish())
    expect(transcribe).toHaveBeenCalledOnce()
    expect((transcribe.mock.calls[0] as unknown as [Blob])[0].type).toBe('audio/webm')
    expect(stopTrack).toHaveBeenCalled()
    expect(result.current.stage).toBe('idle')
  })
  it('cancels a clip without uploading it', async () => {
    const transcribe = vi.fn(async () => undefined)
    const { result } = renderHook(() => useCommandRecording(transcribe, vi.fn()))
    await act(async () => result.current.start())
    act(() => result.current.cancel())
    expect(transcribe).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalled()
    expect(result.current.stage).toBe('idle')
  })
  it('discards microphone access granted after cancellation and releases it on unmount', async () => {
    let grant!: (value: typeof stream) => void
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValueOnce(
      new Promise((resolve) => {
        grant = resolve
      }),
    )
    const transcribe = vi.fn(async () => undefined)
    const { result, unmount } = renderHook(() => useCommandRecording(transcribe, vi.fn()))
    let starting: Promise<void>
    act(() => {
      starting = result.current.start()
    })
    act(() => result.current.cancel())
    await act(async () => {
      grant(stream)
      await starting
    })
    expect(transcribe).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalled()
    await act(async () => result.current.start())
    unmount()
    expect(Recorder.latest.state).toBe('inactive')
  })
  it('invalidates a transcription callback when cancelled during upload', async () => {
    let isCurrent: (() => boolean) | undefined
    let complete!: () => void
    const transcribe = vi.fn((_blob: Blob, current: () => boolean) => {
      isCurrent = current
      return new Promise<void>((resolve) => {
        complete = resolve
      })
    })
    const { result } = renderHook(() => useCommandRecording(transcribe, vi.fn()))
    await act(async () => result.current.start())
    act(() => result.current.finish())
    expect(result.current.stage).toBe('transcribing')
    act(() => result.current.cancel())
    expect(isCurrent?.()).toBe(false)
    await act(async () => complete())
    await waitFor(() => expect(result.current.stage).toBe('idle'))
  })
})
