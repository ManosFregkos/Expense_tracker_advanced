export type JarvisCommand =
  | { type: 'stop' }
  | { type: 'wake'; question: string }
  | { type: 'question'; question: string }
  | { type: 'ignore' }

export function parseJarvisCommand(text: string, awake: boolean): JarvisCommand {
  const normalized = text
    .trim()
    .normalize('NFC')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
  // Stop takes precedence, even while a reply is being generated or spoken.
  const folded = normalized.normalize('NFD').replace(/\p{M}/gu, '')
  const name = '(?:jarvis|jervis|τζαρβις|τζερβις|τζαβις|τσαρβις|τζαρβισ)'
  const start = '(?<![\\p{L}\\p{N}])'
  const end = '(?![\\p{L}\\p{N}])'
  if (
    new RegExp(
      `${start}(?:${name}\\s+(?:stop|στοπ|σταματα|σταματησε|παυση|τελος)|(?:σταματα|σταματησε)\\s+${name})${end}`,
      'iu',
    ).test(folded)
  )
    return { type: 'stop' }
  const wake = new RegExp(
    `${start}(?:(?:hello|χελο|χελλο|χαλο|γεια(?: σου| σας)?|καλημερα|ξυπνα)\\s+${name}|${name}\\s+ξυπνα)${end}`,
    'iu',
  ).exec(folded)
  if (wake) return { type: 'wake', question: normalized.slice(wake.index + wake[0].length).trim() }
  return awake && text.trim() ? { type: 'question', question: text.trim() } : { type: 'ignore' }
}
