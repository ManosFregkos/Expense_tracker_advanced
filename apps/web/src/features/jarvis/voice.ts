export type VoiceCommand =
  | { type: 'stop' }
  | { type: 'wake'; message: string }
  | { type: 'message'; message: string }
  | { type: 'uncertain-wake' }
  | { type: 'ignore' }

// Accept a small set of common name transcriptions, never arbitrary similar-sounding names.
const wakeName = '(?:jarvis|jarivs|jervis|jarves|jarvice|javis)'
const stopPhrase = new RegExp(`^(?:hey[,\\s]+)?${wakeName}[,.!?\\s]+stop[.!?\\s]*$`, 'i')
const wakePhrase = new RegExp(`^(?:hey|hi)[,\\s]+${wakeName}(?=$|[,.!?\\s])[,.!?\\s]*`, 'i')
const greetingOnly = /^(?:hey|hi)[,\s]+[^\s,.!?]+[.!?\s]*$/i

export function parseVoiceCommand(text: string, active: boolean, speaking = false): VoiceCommand {
  const clean = text
    .trim()
    .replace(/^[“”"‘’]+|[“”"‘’]+$/g, '')
    .trim()
  if (stopPhrase.test(clean)) return { type: 'stop' }
  // Ignore speaker echo while reading answers, but keep the stop phrase available.
  if (speaking) return { type: 'ignore' }
  const wake = wakePhrase.exec(clean)
  if (wake) return { type: 'wake', message: clean.slice(wake[0].length).trim() }
  if (greetingOnly.test(clean)) return { type: 'uncertain-wake' }
  return active && clean ? { type: 'message', message: clean } : { type: 'ignore' }
}

export interface RecognitionResult {
  isFinal: boolean
  readonly length?: number
  readonly [index: number]: { transcript: string }
  0: { transcript: string }
}

export function recognitionTranscript(result: RecognitionResult): string {
  const primary = result[0].transcript.trim()
  // Alternate hypotheses can help wake the panel. Never substitute an alternate command,
  // amount, category, or confirmation for what the primary transcript actually contains.
  if (greetingOnly.test(primary) && parseVoiceCommand(primary, false).type !== 'wake') {
    for (let index = 1; index < (result.length ?? 1); index += 1) {
      const alternative = result[index]?.transcript.trim()
      if (!alternative) continue
      const command = parseVoiceCommand(alternative, false)
      if (command.type === 'wake' && !command.message) return alternative
    }
  }
  return primary
}
export interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
export interface VoiceRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives?: number
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  onaudiostart?: (() => void) | null
  onspeechstart?: (() => void) | null
  onspeechend?: (() => void) | null
  onnomatch?: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export function recognitionConstructor(): (new () => VoiceRecognition) | undefined {
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => VoiceRecognition
    webkitSpeechRecognition?: new () => VoiceRecognition
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}
