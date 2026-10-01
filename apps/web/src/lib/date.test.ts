import { describe, expect, it } from 'vitest'
import { historyMonths } from './date'

describe('historyMonths', () => {
  it('includes the current household month and twelve earlier months across years', () => {
    const months = historyMonths('Europe/Athens', new Date('2025-12-31T22:30:00Z'))
    expect(months).toHaveLength(13)
    expect(months[0]).toMatchObject({ value: '2026-01' })
    expect(months[12]).toMatchObject({ value: '2025-01' })
    expect(new Set(months.map((month) => month.value)).size).toBe(13)
  })
})
