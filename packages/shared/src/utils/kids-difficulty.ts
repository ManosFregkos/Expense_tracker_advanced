export function nextKidsDifficulty(
  current: number,
  recentResults: readonly boolean[],
  roundsSinceChange: number,
  mode: 'AUTO' | 'EASY' | 'MEDIUM' | 'HARD',
  maximum = 4,
): number {
  const safeCurrent = Math.min(maximum, Math.max(1, current))
  if (mode !== 'AUTO' || roundsSinceChange < 5 || recentResults.length < 6) return safeCurrent
  const recent = recentResults.slice(-6)
  const successes = recent.filter(Boolean).length
  if (successes >= 5) return Math.min(maximum, safeCurrent + 1)
  if (successes <= 2) return Math.max(1, safeCurrent - 1)
  return safeCurrent
}
