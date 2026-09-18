import { describe, expect, it } from 'vitest'
import { bankTransactionDocumentId } from './banking.js'

describe('bank import idempotency', () => {
  it('uses a stable id per connection and external transaction', () => {
    const first = bankTransactionDocumentId('connection-a', 'external-123')
    expect(first).toBe(bankTransactionDocumentId('connection-a', 'external-123'))
    expect(first).not.toBe(bankTransactionDocumentId('connection-b', 'external-123'))
  })
})
