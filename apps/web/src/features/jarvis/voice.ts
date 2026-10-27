export type VoiceCommand =
  | { type: 'stop' }
  | { type: 'wake'; message: string }
  | { type: 'message'; message: string }
  | { type: 'ignore' }

export function parseVoiceCommand(text: string, active: boolean, speaking = false): VoiceCommand {
  const clean = text.trim()
  if (/^(?:hey[,\s]+)?jarvis[,\s]+stop[.!?\s]*$/i.test(clean)) return { type: 'stop' }
  // Ignore speaker echo while reading answers, but keep the stop phrase available.
  if (speaking) return { type: 'ignore' }
  const wake = /^(?:hey|hi)[,\s]+jarvis\b[,.!?\s]*/i.exec(clean)
  if (wake) return { type: 'wake', message: clean.slice(wake[0].length).trim() }
  return active && clean ? { type: 'message', message: clean } : { type: 'ignore' }
}

export interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
export interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
export interface VoiceRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  abort(): void
}
export function recognitionConstructor(): (new () => VoiceRecognition) | undefined {
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => VoiceRecognition
    webkitSpeechRecognition?: new () => VoiceRecognition
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}
