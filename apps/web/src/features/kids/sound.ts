export function playKidsSound(enabled: boolean, kind: 'correct' | 'complete') {
  if (!enabled) return
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(kind === 'correct' ? 523 : 440, context.currentTime)
    oscillator.frequency.linearRampToValueAtTime(
      kind === 'correct' ? 659 : 660,
      context.currentTime + 0.18,
    )
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.linearRampToValueAtTime(0.06, context.currentTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.31)
    oscillator.onended = () => {
      void context.close()
    }
  } catch {
    /* unsupported TV audio API */
  }
}
