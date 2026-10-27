import { useCallback, useEffect, useRef, useState } from 'react'
import { recognitionConstructor, recognitionTranscript, type VoiceRecognition } from './voice'

export function useJarvisVoice(language: string, onTranscript: (text: string) => void) {
  const [enabled, setEnabled] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')
  const handler = useRef(onTranscript)
  const release = useRef<() => void>(() => undefined)
  handler.current = onTranscript
  const supported = Boolean(recognitionConstructor())

  const stop = useCallback(() => {
    release.current()
    setEnabled(false)
    setListening(false)
    setInterimTranscript('')
    setNotice('')
  }, [])

  // Register handlers before start(), retaining the click's microphone permission gesture.
  const start = useCallback(() => {
    release.current()
    setEnabled(false)
    setError('')
    setNotice('')
    setLastTranscript('')
    setInterimTranscript('')
    setListening(false)
    const Constructor = recognitionConstructor()
    if (!Constructor) {
      setError('Voice recognition is unavailable in this browser. You can still type below.')
      return
    }
    if (!window.isSecureContext) {
      setError('Voice needs HTTPS or localhost.')
      return
    }
    let current: VoiceRecognition
    try {
      current = new Constructor()
    } catch {
      setError(
        'Could not initialize speech recognition. Try another supported browser or type below.',
      )
      return
    }
    current.lang = language
    current.continuous = true
    current.interimResults = true
    current.maxAlternatives = 3
    // Do not set experimental `phrases`, even to []. Some remote providers reject
    // the recognition session once this property has been configured at all.
    let disposed = false
    let restartTimer: ReturnType<typeof setTimeout> | undefined
    let rapidEnds = 0
    let lastStart = Date.now()
    let heardAnyWords = false
    let partial = ''
    let finalized = new Set<number>()

    const visibility = () => {
      if (document.hidden)
        fail('Voice paused because this page is in the background. Enable voice when you return.')
    }
    const dispose = () => {
      if (disposed) return
      disposed = true
      clearTimeout(restartTimer)
      clearTimeout(watchdog)
      document.removeEventListener('visibilitychange', visibility)
      current.onresult = null
      current.onerror = null
      current.onend = null
      current.onstart = null
      current.onaudiostart = null
      current.onspeechstart = null
      current.onspeechend = null
      current.onnomatch = null
      current.abort()
    }
    const fail = (message: string) => {
      dispose()
      setError(message)
      setEnabled(false)
      setListening(false)
      setInterimTranscript('')
    }
    release.current = dispose
    current.onstart = () => {
      lastStart = Date.now()
      finalized = new Set()
      setListening(true)
    }
    current.onaudiostart = () => {
      if (!heardAnyWords)
        setNotice('Microphone is active. Say “Hey Jarvis, what is 2 plus 2?” then pause.')
    }
    current.onspeechstart = () => setNotice('Speech detected. Listening for your words…')
    current.onspeechend = () => {
      // Ask the provider to finalize captured audio; never execute interim text.
      try {
        current.stop()
      } catch {
        /* The provider may already be ending this utterance. */
      }
    }
    current.onnomatch = () =>
      setNotice(
        'Speech was detected, but no words were recognized. Check the voice language and try again.',
      )
    current.onresult = (event) => {
      if (disposed) return
      rapidEnds = 0
      const interim: string[] = []
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result ? recognitionTranscript(result) : ''
        if (!result || !text) continue
        heardAnyWords = true
        setNotice('')
        if (result.isFinal) {
          if (finalized.has(index)) continue
          finalized.add(index)
          setLastTranscript(text)
          handler.current(text)
        } else interim.push(text)
      }
      partial = interim.join(' ')
      setInterimTranscript(partial)
    }
    current.onerror = (event) => {
      if (disposed || event.error === 'aborted') return
      if (event.error === 'no-speech') {
        setNotice(
          'No speech detected. Check your browser’s microphone input and selected voice language, then try again.',
        )
        return
      }
      fail(
        ['not-allowed', 'service-not-allowed'].includes(event.error)
          ? 'Microphone permission was denied. Allow microphone access in browser settings, then enable voice again.'
          : event.error === 'audio-capture'
            ? 'No microphone is available. Connect one and try again.'
            : `Speech recognition stopped (${event.error}). Check your connection and enable voice again.`,
      )
    }
    current.onend = () => {
      if (disposed) return
      setListening(false)
      if (partial)
        setNotice(
          'Your browser heard speech but did not finalize it. Try a shorter sentence and pause, or type the request below.',
        )
      rapidEnds = Date.now() - lastStart < 1500 ? rapidEnds + 1 : 0
      if (rapidEnds >= 4) {
        fail(
          'The browser keeps stopping speech recognition. Enable voice to retry, or type your request.',
        )
        return
      }
      restartTimer = setTimeout(() => {
        if (disposed) return
        partial = ''
        setInterimTranscript('')
        try {
          current.start()
        } catch {
          fail('Voice stopped. Enable voice to listen again.')
        }
      }, 500)
    }
    document.addEventListener('visibilitychange', visibility)
    const watchdog = setTimeout(() => {
      if (!disposed && !heardAnyWords)
        setNotice(
          'No words recognized yet. Check the selected microphone and voice language. You can test GPT by typing below.',
        )
    }, 12_000)
    setEnabled(true)
    try {
      current.start()
    } catch {
      fail('Could not start the microphone. Check browser permissions and try again.')
    }
  }, [language])

  useEffect(() => () => release.current(), [])
  return {
    enabled,
    listening,
    error,
    notice,
    interimTranscript,
    lastTranscript,
    supported,
    start,
    stop,
  }
}
