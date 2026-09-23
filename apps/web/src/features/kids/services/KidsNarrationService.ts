export interface NarrationRequest {
  text: string
  audioSrc?: string
}

export class KidsNarrationService {
  private audio: HTMLAudioElement | null = null

  cancel() {
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
      this.audio = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  async speak(request: NarrationRequest): Promise<boolean> {
    this.cancel()
    if (request.audioSrc) {
      try {
        this.audio = new Audio(request.audioSrc)
        await this.audio.play()
        return true
      } catch {
        this.audio = null
      }
    }
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      return false
    }
    try {
      const utterance = new SpeechSynthesisUtterance(request.text)
      utterance.lang = 'el-GR'
      utterance.rate = 0.86
      utterance.pitch = 1
      const voices = window.speechSynthesis.getVoices()
      utterance.voice =
        voices.find((voice) => voice.lang.toLowerCase() === 'el-gr') ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith('el')) ??
        null
      window.speechSynthesis.speak(utterance)
      return true
    } catch {
      return false
    }
  }
}

export const kidsNarration = new KidsNarrationService()
