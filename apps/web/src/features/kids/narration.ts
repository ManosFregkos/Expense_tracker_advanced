export class KidsNarrationService {
  private audio: HTMLAudioElement | null = null
  private lastText = ''
  private lastAt = 0
  cancel() {
    try {
      this.audio?.pause()
      this.audio = null
      window.speechSynthesis?.cancel()
    } catch {
      /* unsupported TV API */
    }
  }
  speak(text: string, enabled: boolean, audioUrl?: string, force = false) {
    if (!enabled || (!force && text === this.lastText && Date.now() - this.lastAt < 1200)) return
    this.cancel()
    this.lastText = text
    this.lastAt = Date.now()
    if (audioUrl) {
      try {
        this.audio = new Audio(audioUrl)
        void this.audio.play().catch(() => this.synthesize(text))
        return
      } catch {
        /* use speech */
      }
    }
    this.synthesize(text)
  }
  private synthesize(text: string) {
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return
      const speech = new SpeechSynthesisUtterance(text)
      speech.lang = 'el-GR'
      speech.rate = 0.88
      const voice = window.speechSynthesis
        .getVoices()
        .find((item) => item.lang.toLowerCase().startsWith('el'))
      if (voice) speech.voice = voice
      window.speechSynthesis.speak(speech)
    } catch {
      /* visible text remains available */
    }
  }
}
export const narration = new KidsNarrationService()
