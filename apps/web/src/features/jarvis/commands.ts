export type JarvisCommand =
  | { type: 'stop' }
  | { type: 'wake'; question: string }
  | { type: 'question'; question: string }
  | { type: 'ignore' }

export function parseJarvisCommand(text: string, awake: boolean): JarvisCommand {
  const normalized = text
    .trim()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
  // Stop takes precedence, even while a reply is being generated or spoken.
  if (/\bjarvis\s+stop\b/i.test(normalized)) return { type: 'stop' }
  const wake = /\bhello\s+jarvis\b/i.exec(normalized)
  if (wake) return { type: 'wake', question: normalized.slice(wake.index + wake[0].length).trim() }
  return awake && text.trim() ? { type: 'question', question: text.trim() } : { type: 'ignore' }
}
