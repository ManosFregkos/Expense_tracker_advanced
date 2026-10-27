import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJarvisVoice } from './useJarvisVoice'
import type { VoiceRecognition } from './voice'

class Recognition implements VoiceRecognition {
  static latest: Recognition
  lang = ''
  continuous = false
  interimResults = false
  onstart: VoiceRecognition['onstart'] = null
  onend: VoiceRecognition['onend'] = null
  onerror: VoiceRecognition['onerror'] = null
  onresult: VoiceRecognition['onresult'] = null
  start = vi.fn()
  abort = vi.fn()
  constructor() {
    Recognition.latest = this
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('SpeechRecognition', Recognition)
  vi.stubGlobal('isSecureContext', true)
})
afterEach(() => {
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
