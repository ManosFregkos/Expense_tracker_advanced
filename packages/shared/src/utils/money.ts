const MINOR_DIGITS: Readonly<Record<string, number>> = { JPY: 0, KRW: 0, BHD: 3, KWD: 3 }

export function currencyMinorDigits(currency: string): number {
  return MINOR_DIGITS[currency.toUpperCase()] ?? 2
}

export function parseMoneyToMinor(input: string, currency = 'EUR'): number {
  const digits = currencyMinorDigits(currency)
  let normalized = input.trim().replace(/\s/g, '')
  if (!normalized) throw new Error('Amount is required')

  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  const decimalIndex = Math.max(comma, dot)
  if (decimalIndex >= 0) {
    const whole = normalized.slice(0, decimalIndex).replace(/[.,]/g, '')
    const fraction = normalized.slice(decimalIndex + 1).replace(/[.,]/g, '')
    normalized = `${whole}.${fraction}`
  }

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Invalid monetary amount')
  const negative = normalized.startsWith('-')
  const unsigned = normalized.replace(/^[+-]/, '')
  const [whole = '0', fraction = ''] = unsigned.split('.')
  if (fraction.length > digits) throw new Error(`Amount supports at most ${digits} decimal places`)
  const minorText = `${whole}${fraction.padEnd(digits, '0')}`.replace(/^0+(?=\d)/, '')
  const value = Number(minorText || '0') * (negative ? -1 : 1)
  if (!Number.isSafeInteger(value)) throw new Error('Amount is outside the supported range')
  return value
}

export function formatMoney(amountMinor: number, currency = 'EUR', locale = 'en-IE'): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Money must be a safe integer')
  const digits = currencyMinorDigits(currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits)
}

export function addMinor(...amounts: number[]): number {
  const total = amounts.reduce((sum, amount) => {
    if (!Number.isSafeInteger(amount)) throw new Error('Money must be a safe integer')
    return sum + amount
  }, 0)
  if (!Number.isSafeInteger(total)) throw new Error('Money calculation overflow')
  return total
}
