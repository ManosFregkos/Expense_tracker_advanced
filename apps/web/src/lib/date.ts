import type { StoredDate } from '@family-expense-tracker/shared'

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
