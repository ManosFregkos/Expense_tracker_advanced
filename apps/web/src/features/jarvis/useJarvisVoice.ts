import { useCallback, useEffect, useRef, useState } from 'react'
import { recognitionConstructor, type VoiceRecognition } from './voice'

export function useJarvisVoice(language: string, onTranscript: (text: string) => void) {
  const [enabled, setEnabled] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognition = useRef<VoiceRecognition | null>(null)
  const handler = useRef(onTranscript)
  handler.current = onTranscript
  const supported = Boolean(recognitionConstructor())

  // Starting is called directly from a click, preserving the browser's user gesture.
  const start = useCallback(() => {
    setError('')
    const Constructor = recognitionConstructor()
    if (!Constructor) {
      setError('Voice recognition is unavailable in this browser. You can still type below.')
      return
    }
    if (!window.isSecureContext) {
      setError('Voice needs HTTPS or localhost.')
      return
    }
    try {
      recognition.current = new Constructor()
      recognition.current.lang = language
      recognition.current.continuous = true
      recognition.current.interimResults = false
      recognition.current.start()
      setEnabled(true)
    } catch {
      recognition.current = null
      setError('Could not start the microphone. Check browser permissions and try again.')
    }
  }, [language])
  const stop = useCallback(() => {
    setEnabled(false)
    setListening(false)
    recognition.current?.abort()
  }, [])

  useEffect(() => {
    if (!enabled || !recognition.current) return
    const current = recognition.current
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let rapidEnds = 0
    let lastStart = Date.now()
    const fail = (message: string) => {
      setError(message)
      setEnabled(false)
      setListening(false)
      disposed = true
      current.abort()
    }
    current.onstart = () => {
      lastStart = Date.now()
      setListening(true)
    }
    current.onresult = (event) => {
      rapidEnds = 0
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result?.isFinal) handler.current(result[0].transcript)
      }
    }
    current.onerror = (event) => {
      if (disposed || event.error === 'aborted' || event.error === 'no-speech') return
      fail(
        ['not-allowed', 'service-not-allowed'].includes(event.error)
          ? 'Microphone permission was denied. Allow microphone access in browser settings, then enable voice again.'
          : event.error === 'audio-capture'
            ? 'No microphone is available. Connect one and try again.'
            : 'Speech recognition stopped. Check your connection and enable voice again.',
      )
    }
    current.onend = () => {
      setListening(false)
      if (disposed) return
      rapidEnds = Date.now() - lastStart < 1500 ? rapidEnds + 1 : 0
      if (rapidEnds >= 4) {
        fail(
          'The browser keeps stopping speech recognition. Enable voice to retry, or type your request.',
        )
        return
      }
      timer = setTimeout(() => {
        if (disposed) return
        try {
          current.start()
        } catch {
          fail('Voice stopped. Enable voice to listen again.')
        }
      }, 500)
    }
    const visibility = () => {
      if (document.hidden)
        fail('Voice paused because this page is in the background. Enable voice when you return.')
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibility)
      current.onresult = null
      current.onerror = null
      current.onend = null
      current.onstart = null
      current.abort()
    }
  }, [enabled])

  useEffect(
    () => () => {
      recognition.current?.abort()
    },
    [],
  )
  return { enabled, listening, error, supported, start, stop }
}
