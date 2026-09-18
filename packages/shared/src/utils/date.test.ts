import { describe, expect, it } from 'vitest'
import { dateRangeForPreset, monthKey } from './date.js'

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
})
