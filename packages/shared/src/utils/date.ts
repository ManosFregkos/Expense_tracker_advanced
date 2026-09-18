export function monthKey(date: Date, timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  if (!year || !month) throw new Error('Could not derive month key')
  return `${year}-${month}`
}

export function startOfMonthUtc(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
}

export function dateRangeForPreset(
  preset: 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'LAST_6_MONTHS' | 'THIS_YEAR',
  now = new Date(),
): { start: Date; end: Date } {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const end = new Date(Date.UTC(year, month + 1, 1))
  if (preset === 'THIS_MONTH') return { start: startOfMonthUtc(year, month), end }
  if (preset === 'LAST_MONTH')
    return { start: startOfMonthUtc(year, month - 1), end: startOfMonthUtc(year, month) }
  if (preset === 'LAST_3_MONTHS') return { start: startOfMonthUtc(year, month - 2), end }
  if (preset === 'LAST_6_MONTHS') return { start: startOfMonthUtc(year, month - 5), end }
  return { start: startOfMonthUtc(year, 0), end }
}
