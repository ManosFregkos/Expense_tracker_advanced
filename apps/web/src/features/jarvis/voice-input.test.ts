import { afterEach, describe, expect, it, vi } from 'vitest'
import { JarvisVoiceInput } from './voice-input'

class MockRecognition {
  static latest: MockRecognition
  lang = ''
  continuous = false
  interimResults = false
  onresult:
    | ((event: {
        resultIndex: number
        results: Array<{ isFinal: boolean; 0: { transcript: string } }>
      }) => void)
    | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  abort = vi.fn()
  constructor() {
    MockRecognition.latest = this
  }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition
})
describe('Jarvis voice lifecycle', () => {
  it('recognizes the wake phrase from interim speech before waiting for an utterance to end', async () => {
    Object.assign(window, { SpeechRecognition: MockRecognition })
    const callbacks = { transcript: vi.fn(), audio: vi.fn(), state: vi.fn(), error: vi.fn() }
    const input = new JarvisVoiceInput(callbacks)
    await input.start('el-GR')
    MockRecognition.latest.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'Hello Jarvis' } }],
    })
    expect(callbacks.transcript).toHaveBeenCalledWith('Hello Jarvis')
    input.stop()
  })
  it('falls back to recording when the browser speech service is unavailable, without another recognition loop', async () => {
    Object.assign(window, { SpeechRecognition: MockRecognition })
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => undefined))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('MediaRecorder', class {})
    vi.stubGlobal('AudioContext', class {})
    const input = new JarvisVoiceInput({
      transcript: vi.fn(),
      audio: vi.fn(),
      state: vi.fn(),
      error: vi.fn(),
    })
    await input.start('el-GR')
    const recognition = MockRecognition.latest
    recognition.onerror?.({ error: 'service-not-allowed' })
    expect(recognition.abort).toHaveBeenCalledOnce()
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(recognition.onend).toBeNull()
    input.stop()
  })
  it('waits for the complete question and preserves Greek stop commands during playback', async () => {
    Object.assign(window, { SpeechRecognition: MockRecognition })
    const callbacks = { transcript: vi.fn(), audio: vi.fn(), state: vi.fn(), error: vi.fn() }
    const input = new JarvisVoiceInput(callbacks)
    await input.start('el-GR')
    const result = { isFinal: false, 0: { transcript: 'Hello Jarvis add a' } }
    MockRecognition.latest.onresult?.({ resultIndex: 0, results: [result] })
    expect(callbacks.transcript).not.toHaveBeenCalled()
    result.isFinal = true
    result[0].transcript = 'Hello Jarvis add a task for tomorrow'
    MockRecognition.latest.onresult?.({ resultIndex: 0, results: [result] })
    expect(callbacks.transcript).toHaveBeenCalledWith('Hello Jarvis add a task for tomorrow')
    input.muteRecording(true)
    MockRecognition.latest.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'Τζάρβις στοπ' } }],
    })
    expect(callbacks.transcript).toHaveBeenLastCalledWith('Τζάρβις στοπ')
    input.stop()
  })
  it('discards silence and ordinary playback echo, but accepts stop through cloud transcription', async () => {
    vi.useFakeTimers()
    let loud = false
    const release = vi.fn()
    const close = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: release }] }),
      },
    })
    vi.stubGlobal(
      'AudioContext',
      class {
        resume = vi.fn().mockResolvedValue(undefined)
        close = close
        createMediaStreamSource() {
          return { connect: vi.fn() }
        }
        createAnalyser() {
          return {
            fftSize: 2048,
            getFloatTimeDomainData: (samples: Float32Array) => samples.fill(loud ? 0.1 : 0),
          }
        }
      },
    )
    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported(type: string) {
          return type === 'audio/webm'
        }
        state = 'inactive'
        ondataavailable: ((event: { data: Blob }) => void) | null = null
        onstop: (() => void) | null = null
        onerror: (() => void) | null = null
        start() {
          this.state = 'recording'
        }
        stop() {
          this.state = 'inactive'
          this.ondataavailable?.({ data: new Blob(['complete audio']) })
          queueMicrotask(() => this.onstop?.())
        }
      },
    )
    const callbacks = {
      transcript: vi.fn(),
      audio: vi.fn().mockResolvedValue('Hello Sir'),
      state: vi.fn(),
      error: vi.fn(),
    }
    const input = new JarvisVoiceInput(callbacks)
    await input.start('en-US')
    await vi.advanceTimersByTimeAsync(20_050)
    expect(callbacks.audio).not.toHaveBeenCalled()
    input.muteRecording(true)
    loud = true
    await vi.advanceTimersByTimeAsync(300)
    loud = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(callbacks.audio).toHaveBeenCalledOnce()
    expect(callbacks.transcript).not.toHaveBeenCalled()
    callbacks.audio.mockResolvedValueOnce('Jarvis stop')
    loud = true
    await vi.advanceTimersByTimeAsync(300)
    loud = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(callbacks.transcript).toHaveBeenCalledWith('Jarvis stop')
    input.stop()
    expect(release).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
  it('restarts foreground speech recognition and recognizes stop while an answer is speaking', async () => {
    vi.useFakeTimers()
    Object.assign(window, { SpeechRecognition: MockRecognition })
    const callbacks = { transcript: vi.fn(), audio: vi.fn(), state: vi.fn(), error: vi.fn() }
    const input = new JarvisVoiceInput(callbacks)
    await input.start('el-GR')
    const recognition = MockRecognition.latest
    expect(recognition.lang).toBe('el-GR')
    input.muteRecording(true)
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'Jarvis stop' } }],
    })
    expect(callbacks.transcript).toHaveBeenCalledWith('Jarvis stop')
    recognition.onend?.()
    await vi.advanceTimersByTimeAsync(400)
    expect(recognition.start).toHaveBeenCalledTimes(2)
    input.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(recognition.start).toHaveBeenCalledTimes(2)
    expect(recognition.abort).toHaveBeenCalledOnce()
  })
  it('stops repeated permission requests after a denial', async () => {
    Object.assign(window, { SpeechRecognition: MockRecognition })
    const callbacks = { transcript: vi.fn(), audio: vi.fn(), state: vi.fn(), error: vi.fn() }
    const input = new JarvisVoiceInput(callbacks)
    await input.start('en-US')
    MockRecognition.latest.onerror?.({ error: 'not-allowed' })
    expect(callbacks.error).toHaveBeenCalledWith(expect.stringContaining('denied'))
    expect(callbacks.state).toHaveBeenLastCalledWith('off')
    expect(MockRecognition.latest.onend).toBeNull()
  })
  it('releases a microphone stream if permission resolves after listening was disabled', async () => {
    const stop = vi.fn()
    let grant: ((stream: MediaStream) => void) | undefined
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve
        }),
    )
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('MediaRecorder', class {})
    vi.stubGlobal('AudioContext', class {})
    const input = new JarvisVoiceInput({
      transcript: vi.fn(),
      audio: vi.fn(),
      state: vi.fn(),
      error: vi.fn(),
    })
    const starting = input.start('en-US', true)
    input.stop()
    grant?.({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await starting
    expect(stop).toHaveBeenCalledOnce()
  })
})
