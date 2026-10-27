import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJarvisVoice } from './useJarvisVoice'
import type { VoiceRecognition } from './voice'

class Recognition implements VoiceRecognition {
  static latest: Recognition
  static startupError: string | null = null
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  phrases: object[] = []
  onstart: VoiceRecognition['onstart'] = null
  onend: VoiceRecognition['onend'] = null
  onerror: VoiceRecognition['onerror'] = null
  onresult: VoiceRecognition['onresult'] = null
  onaudiostart: VoiceRecognition['onaudiostart'] = null
  onspeechstart: VoiceRecognition['onspeechstart'] = null
  onspeechend: VoiceRecognition['onspeechend'] = null
  onnomatch: VoiceRecognition['onnomatch'] = null
  start = vi.fn(() => {
    if (Recognition.startupError) this.onerror?.({ error: Recognition.startupError })
    else this.onstart?.()
  })
  stop = vi.fn()
  abort = vi.fn()
  constructor() {
    Recognition.latest = this
  }
}
beforeEach(() => {
  Recognition.startupError = null
  vi.useFakeTimers()
  vi.stubGlobal('SpeechRecognition', Recognition)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('SpeechRecognitionPhrase', undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('Jarvis recognition lifecycle', () => {
  it('starts only on opt-in and forwards final transcripts in the selected language', () => {
    const handler = vi.fn()
    const { result } = renderHook(() => useJarvisVoice('el-GR', handler))
    expect(result.current.enabled).toBe(false)
    act(() => result.current.start())
    const microphone = Recognition.latest
    expect(microphone.start).toHaveBeenCalledOnce()
    expect(microphone.lang).toBe('el-GR')
    expect(microphone.interimResults).toBe(true)
    expect(microphone.maxAlternatives).toBe(3)
    expect(result.current.listening).toBe(true)
    act(() =>
      microphone.onresult?.({
        resultIndex: 0,
        results: [
          { isFinal: false, 0: { transcript: 'partial' } },
          { isFinal: true, 0: { transcript: 'Hey Jarvis' } },
        ],
      }),
    )
    expect(handler).toHaveBeenCalledExactlyOnceWith('Hey Jarvis')
    expect(result.current.lastTranscript).toBe('Hey Jarvis')
  })
  it('boosts Jarvis where supported and falls back if the provider rejects speech hints', () => {
    class Phrase {
      constructor(
        readonly phrase: string,
        readonly boost: number,
      ) {}
    }
    vi.stubGlobal('SpeechRecognitionPhrase', Phrase)
    const { result } = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    act(() => result.current.start())
    const microphone = Recognition.latest
    expect(microphone.phrases).toEqual([
      new Phrase('Jarvis', 5),
      new Phrase('Hey Jarvis', 5),
      new Phrase('Jarvis stop', 5),
    ])
    act(() => {
      microphone.onerror?.({ error: 'phrases-not-supported' })
      microphone.onend?.()
      vi.advanceTimersByTime(500)
    })
    expect(microphone.phrases).toEqual([])
    expect(microphone.start).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBe('')
  })
  it('catches a permission failure emitted synchronously by start', () => {
    Recognition.startupError = 'not-allowed'
    const { result } = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    act(() => result.current.start())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toContain('permission was denied')
  })
  it('shows partial speech without submitting it and asks the provider to finalize when speech ends', () => {
    const handler = vi.fn()
    const { result } = renderHook(() => useJarvisVoice('en-US', handler))
    act(() => result.current.start())
    const microphone = Recognition.latest
    act(() =>
      microphone.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: 'Hey Jarvis add thirty' } }],
      }),
    )
    expect(result.current.interimTranscript).toBe('Hey Jarvis add thirty')
    expect(handler).not.toHaveBeenCalled()
    act(() => microphone.onspeechend?.())
    expect(microphone.stop).toHaveBeenCalledOnce()
    const final = {
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Hey Jarvis add thirty euros' } }],
    }
    act(() => {
      microphone.onresult?.(final)
      microphone.onresult?.(final)
    })
    expect(handler).toHaveBeenCalledExactlyOnceWith('Hey Jarvis add thirty euros')
    expect(result.current.interimTranscript).toBe('')
  })
  it('explains when the provider is listening but has not recognized words', () => {
    const { result } = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    act(() => result.current.start())
    act(() => {
      vi.advanceTimersByTime(12_000)
    })
    expect(result.current.notice).toContain('No words recognized yet')
  })
  it('stops recognition when the page is hidden', () => {
    const { result } = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    act(() => result.current.start())
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toContain('background')
  })
  it('restarts after a normal recognition end but stops restarting when disabled', () => {
    const { result } = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    act(() => result.current.start())
    const microphone = Recognition.latest
    act(() => {
      microphone.onend?.()
      vi.advanceTimersByTime(500)
    })
    expect(microphone.start).toHaveBeenCalledTimes(2)
    act(() => result.current.stop())
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(microphone.start).toHaveBeenCalledTimes(2)
    expect(result.current.enabled).toBe(false)
  })
  it('shows permission failures and stops recognition rather than restarting indefinitely', () => {
    const { result } = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    act(() => result.current.start())
    act(() => Recognition.latest.onerror?.({ error: 'not-allowed' }))
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toContain('permission was denied')
  })
  it('releases microphone handlers on unmount and supports a typed fallback when unavailable', () => {
    const { result, unmount } = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    act(() => result.current.start())
    const microphone = Recognition.latest
    unmount()
    expect(microphone.abort).toHaveBeenCalled()
    expect(microphone.onresult).toBeNull()
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    const unsupported = renderHook(() => useJarvisVoice('en-US', vi.fn()))
    expect(unsupported.result.current.supported).toBe(false)
    act(() => unsupported.result.current.start())
    expect(unsupported.result.current.error).toContain('unavailable')
  })
})
