import { describe, expect, it } from 'vitest'
import { addMinor, formatMoney, parseMoneyToMinor } from './money.js'

describe('money utilities', () => {
  it('parses EUR without floating point arithmetic', () => {
    expect(parseMoneyToMinor('€ 125,50'.replace('€', ''))).toBe(12550)
    expect(parseMoneyToMinor('3.000,25')).toBe(300025)
    expect(parseMoneyToMinor('72.43')).toBe(7243)
  })

  it('rejects excessive precision', () => expect(() => parseMoneyToMinor('1.001')).toThrow())
  it('formats EUR', () => expect(formatMoney(12550, 'EUR', 'en-IE')).toContain('125.50'))
  it('adds integers exactly', () => expect(addMinor(10, 20, -5)).toBe(25))
})
