import type { ChatMessage } from './jarvis-agent.js'

function mentionedCurrencies(message: string): string[] {
  const text = message.normalize('NFKC').toLowerCase()
  const mentions: string[] = []
  const pattern =
    /€|ca?\$|au?\$|\$|£|(?<!\p{L})(?:canadian dollars?|australian dollars?|eur|euros?|usd|dollars?|gbp|pounds?|jpy|yen|chf|cad|aud)(?!\p{L})|ευρώ|ευρω|δολάρια|δολλαρια/giu
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0, match.index - 25), match.index)
    if (/(?:\bnot|\bno|\binstead of|\brather than|όχι)\s*$/iu.test(before)) continue
    const token = match[0]
    mentions.push(
      /^(?:ca?\$|cad|canadian dollars?)$/u.test(token)
        ? 'CAD'
        : /^(?:au?\$|aud|australian dollars?)$/u.test(token)
          ? 'AUD'
          : /^(?:€|eur|euros?|ευρώ|ευρω)$/u.test(token)
            ? 'EUR'
            : /^(?:\$|usd|dollars?|δολάρια|δολλαρια)$/u.test(token)
              ? 'USD'
              : /^(?:£|gbp|pounds?)$/u.test(token)
                ? 'GBP'
                : /^(?:jpy|yen)$/u.test(token)
                  ? 'JPY'
                  : token.toUpperCase(),
    )
  }
  return [...new Set(mentions)]
}

export function resolveJarvisCurrency(
  message: string,
  fallback: string,
  history: ChatMessage[] = [],
): { currency: string | null; source: string } {
  const explicit = mentionedCurrencies(message)
  if (explicit.length)
    return { currency: explicit.length === 1 ? explicit[0]! : null, source: 'current request' }
  const newRequest =
    /\b(?:add|create|record|log|expense|income|delete|remove|spent|paid|earned|received)\b/i.test(
      message,
    )
  if (!newRequest) {
    for (const turn of [...history].reverse()) {
      if (turn.role !== 'user') continue
      const currencies = mentionedCurrencies(turn.content)
      if (currencies.length)
        return {
          currency: currencies.length === 1 ? currencies[0]! : null,
          source: 'previous user request',
        }
      if (
        /\b(?:add|create|record|log|expense|income|delete|remove|spent|paid|earned|received)\b/i.test(
          turn.content,
        )
      )
        break
    }
  }
  return { currency: fallback, source: 'selected account or household default' }
}
