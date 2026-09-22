import { afterEach, describe, expect, it, vi } from 'vitest'
import { KidsNarrationService } from './narration'

describe('narration fallback', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('does not throw without speech synthesis', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    vi.stubGlobal('SpeechSynthesisUtterance', undefined)
    expect(() => new KidsNarrationService().speak('Γεια', true)).not.toThrow()
  })
  it('cancels previous speech and survives broken TV speech APIs', () => {
    const cancel = vi.fn(),
      speak = vi.fn()
    vi.stubGlobal('speechSynthesis', { cancel, getVoices: () => [], speak })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = ''
        rate = 1
        voice = null
      },
    )
    const service = new KidsNarrationService()
    service.speak('Ένα', true)
    service.speak('Δύο', true)
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(speak).toHaveBeenCalledTimes(2)
    vi.stubGlobal('speechSynthesis', {
      cancel: () => {
        throw Error('TV bug')
      },
      getVoices: () => {
        throw Error('TV bug')
      },
    })
    expect(() => service.speak('Τρία', true)).not.toThrow()
  })
})
