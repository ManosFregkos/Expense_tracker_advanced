import { parseJarvisCommand } from './commands'

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionConstructor = new () => Recognition
function recognitionConstructor() {
  const browser = window as Window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}
export function voiceCapabilities() {
  return {
    realtime: Boolean(
      typeof RTCPeerConnection !== 'undefined' && navigator.mediaDevices?.getUserMedia,
    ),
    recognition: Boolean(recognitionConstructor()),
    recording: Boolean(
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      typeof AudioContext !== 'undefined',
    ),
  }
}
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result.split(',')[1] ?? '')
        : reject(new Error('Could not read recording.'))
    reader.onerror = () => reject(new Error('Could not read recording.'))
    reader.readAsDataURL(blob)
  })
}

// Both engines are explicitly enabled by a user gesture and only run in the foreground.
export class JarvisVoiceInput {
  private recognition: Recognition | null = null
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private recorder: MediaRecorder | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private restart: ReturnType<typeof setTimeout> | null = null
  private enabled = false
  private generation = 0
  private muted = false
  private manual = false
  private transcribing = false
  private failures = 0

  constructor(
    private callbacks: {
      transcript(text: string): void
      audio(blob: Blob): Promise<string>
      state(
        state: 'off' | 'listening' | 'recording' | 'transcribing',
        engine?: 'browser' | 'cloud',
      ): void
      error(message: string): void
    },
  ) {}

  async start(language: string, manual = false) {
    this.stop()
    this.enabled = true
    this.manual = manual
    this.muted = false
    const generation = this.generation
    const Constructor = recognitionConstructor()
    if (Constructor && !manual) {
      const recognition = new Constructor()
      this.recognition = recognition
      recognition.lang = language
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        if (!this.enabled || generation !== this.generation) return
        this.failures = 0
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const command = parseJarvisCommand(result?.[0].transcript ?? '', false)
          if (result?.isFinal && (!this.muted || command.type === 'stop'))
            this.callbacks.transcript(result[0].transcript)
          // Interrupt as soon as the stop phrase is recognized, without waiting for a final result.
          else if (command.type === 'stop') this.callbacks.transcript('Jarvis stop')
        }
      }
      recognition.onerror = (event) => {
        if (!this.enabled || generation !== this.generation) return
        if (event.error === 'aborted' || event.error === 'no-speech') return
        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed' ||
          event.error === 'audio-capture'
        ) {
          this.stop()
          this.callbacks.error(
            'Microphone access was denied or is unavailable. Allow microphone access and try again, or type your question.',
          )
        } else {
          this.failures++
          if (this.failures >= 3) {
            this.stop()
            this.callbacks.error(
              'Browser speech recognition is unavailable. Try Record question or use text.',
            )
          }
        }
      }
      recognition.onend = () => {
        if (!this.enabled || generation !== this.generation) return
        this.restart = setTimeout(() => {
          try {
            recognition.start()
          } catch {
            this.stop()
            this.callbacks.error('Listening ended. Tap Enable microphone to restart.')
          }
        }, 400)
      }
      try {
        recognition.start()
        this.callbacks.state('listening', 'browser')
      } catch {
        this.stop()
        this.callbacks.error('Could not start speech recognition. Try Record question.')
      }
      return
    }
    try {
      if (!voiceCapabilities().recording)
        throw new Error(
          'This browser cannot record audio. Type your question or use a browser with microphone support.',
        )
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      if (!this.enabled || generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.stream = stream
      this.context = new AudioContext()
      await this.context.resume()
      if (!this.enabled || generation !== this.generation) return
      const analyser = this.context.createAnalyser()
      analyser.fftSize = 2048
      this.context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      let startedAt = 0
      let lastSpeechAt = 0
      let speechFrames = 0
      let duringPlayback = false
      const begin = () => {
        const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) =>
          MediaRecorder.isTypeSupported(type),
        )
        if (!mimeType)
          throw new Error('No supported audio recording format is available. Use text instead.')
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
        this.recorder = recorder
        startedAt = Date.now()
        lastSpeechAt = startedAt
        speechFrames = 0
        duringPlayback = false
        const chunks: Blob[] = []
        let send = false
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data)
        }
        recorder.onstop = () => {
          if (!this.enabled || generation !== this.generation || !send) return
          const blob = new Blob(chunks, { type: mimeType })
          const interruptsOnly = duringPlayback
          this.transcribing = true
          this.callbacks.state('transcribing', 'cloud')
          void this.callbacks
            .audio(blob)
            .then((text) => {
              if (
                this.enabled &&
                generation === this.generation &&
                text.trim() &&
                (!interruptsOnly || parseJarvisCommand(text, false).type === 'stop')
              )
                this.callbacks.transcript(text)
            })
            .catch((error: unknown) => {
              if (generation === this.generation) {
                this.stop()
                this.callbacks.error(
                  error instanceof Error ? error.message : 'Could not transcribe audio.',
                )
              }
            })
            .finally(() => {
              if (generation !== this.generation) return
              this.transcribing = false
              if (this.manual) this.stop()
              else if (this.enabled) this.callbacks.state('listening', 'cloud')
            })
        }
        recorder.onerror = () => {
          this.stop()
          this.callbacks.error('Audio recording failed. Please try again.')
        }
        // Used by the sampling loop and the manual "send recording" button.
        this.finishRecording = () => {
          send = true
          if (recorder.state !== 'inactive') recorder.stop()
        }
        recorder.start()
        this.callbacks.state(manual ? 'recording' : 'listening', 'cloud')
      }
      begin()
      this.timer = setInterval(() => {
        if (!this.enabled || this.transcribing) return
        // Keep listening for stop during playback, but suppress ordinary echoed speech.
        if (this.recorder?.state === 'inactive') begin()
        analyser.getFloatTimeDomainData(samples)
        const rms = Math.sqrt(
          samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
        )
        const now = Date.now()
        if (rms > 0.018) {
          if (this.muted) duringPlayback = true
          lastSpeechAt = now
          speechFrames++
          this.callbacks.state('recording', 'cloud')
        }
        if (!manual && speechFrames >= 5 && now - lastSpeechAt > 950) this.finishRecording()
        else if (now - startedAt >= 20_000) {
          if (manual || speechFrames >= 5) this.finishRecording()
          else this.recorder?.stop() // Silence is discarded; each new recorder has its own audio header.
        }
      }, 50)
    } catch (error) {
      if (generation !== this.generation) return
      this.stop()
      this.callbacks.error(
        error instanceof Error ? error.message : 'Could not access the microphone.',
      )
    }
  }

  finishRecording: () => void = () => undefined
  muteRecording(muted: boolean) {
    this.muted = muted
  }
  stop() {
    this.enabled = false
    this.generation++
    this.transcribing = false
    if (this.restart) clearTimeout(this.restart)
    if (this.timer) clearInterval(this.timer)
    this.restart = null
    this.timer = null
    if (this.recognition) {
      this.recognition.onend = null
      this.recognition.onresult = null
      this.recognition.onerror = null
      this.recognition.abort()
      this.recognition = null
    }
    if (this.recorder?.state !== 'inactive') this.recorder?.stop()
    this.recorder = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.context) void this.context.close().catch(() => undefined)
    this.context = null
    this.callbacks.state('off')
  }
}
