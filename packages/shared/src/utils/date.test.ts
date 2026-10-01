import { describe, expect, it } from 'vitest'
import { dateRangeForMonth, dateRangeForPreset, monthKey } from './date.js'

describe('date utilities', () => {
  it('uses the requested timezone at month boundaries', () => {
    const instant = new Date('2026-08-31T22:30:00.000Z')
    expect(monthKey(instant, 'Europe/Athens')).toBe('2026-09')
    expect(monthKey(instant, 'UTC')).toBe('2026-08')
  })

  it('creates stable UTC monthly ranges', () => {
    const range = dateRangeForPreset('LAST_3_MONTHS', new Date('2026-09-18T12:00:00Z'))
    expect(range.start.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('includes the previous calendar year in a rolling twelve-month range', () => {
    const range = dateRangeForPreset('LAST_12_MONTHS', new Date('2026-01-18T12:00:00Z'))
    expect(range.start.toISOString()).toBe('2025-02-01T00:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-02-01T00:00:00.000Z')
  })

  it('uses household midnight across daylight saving changes', () => {
    const range = dateRangeForMonth('2026-10', 'Europe/Athens')
    expect(range.start.toISOString()).toBe('2026-09-30T21:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-10-31T22:00:00.000Z')
  })

  it('uses the household current month when UTC is still in the previous month', () => {
    const range = dateRangeForPreset(
      'THIS_MONTH',
      new Date('2026-08-31T22:30:00Z'),
      'Europe/Athens',
    )
    expect(range.start.toISOString()).toBe('2026-08-31T21:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-09-30T21:00:00.000Z')
  })

  it('rejects invalid month keys', () => {
    expect(() => dateRangeForMonth('2026-13')).toThrow('Invalid month key')
  })
})
