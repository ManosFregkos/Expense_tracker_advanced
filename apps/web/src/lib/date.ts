import { monthKey, type StoredDate } from '@family-expense-tracker/shared'

export function historyMonths(timeZone = 'UTC', now = new Date()) {
  const [year, month] = monthKey(now, timeZone).split('-').map(Number)
  return Array.from({ length: 13 }, (_, offset) => {
    const date = new Date(Date.UTC(year!, month! - 1 - offset, 1))
    return {
      value: monthKey(date),
      label: new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date),
    }
  })
}

export function toDate(value: StoredDate): Date {
  return value instanceof Date ? value : value.toDate()
}

export function formatDate(value: StoredDate, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(toDate(value))
}

export function localDateInputValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function localDateToIso(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString()
}
