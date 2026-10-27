import { describe, expect, it } from 'vitest'
import { resolveJarvisCurrency } from './jarvis-currency.js'

describe('Jarvis currency intent', () => {
  it.each([
    'add 30 euro expense',
    'add 30 euros expense',
    'add 30euros',
    'record €30',
    'add EUR 30',
    'πρόσθεσε 30 ευρώ',
    'use euros not dollars',
  ])('keeps explicit euros as EUR: %s', (message) => {
    expect(resolveJarvisCurrency(message, 'USD').currency).toBe('EUR')
  })
  it('uses the configured default rather than inventing dollars', () => {
    expect(resolveJarvisCurrency('add 30 supermarket expense', 'EUR').currency).toBe('EUR')
  })
  it('preserves explicit foreign currencies and rejects conflicting currencies', () => {
    expect(resolveJarvisCurrency('add $30 expense', 'EUR').currency).toBe('USD')
    expect(resolveJarvisCurrency('add 30 Canadian dollars expense', 'EUR').currency).toBe('CAD')
    expect(resolveJarvisCurrency('add 30 euros or dollars', 'EUR').currency).toBeNull()
  })
  it('retains user currency across a clarification but resets it for a new request', () => {
    const history = [
      { role: 'user', content: 'add 30 dollars supermarket' },
      { role: 'assistant', content: 'Which account?' },
    ] as const
    expect(resolveJarvisCurrency('Dollar cash account', 'EUR', [...history]).currency).toBe('USD')
    expect(resolveJarvisCurrency('add 20 supermarket', 'EUR', [...history]).currency).toBe('EUR')
  })
})
