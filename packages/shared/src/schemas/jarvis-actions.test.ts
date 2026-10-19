import { describe, expect, it } from 'vitest'
import { jarvisPrepareActionSchema, jarvisActionReferenceSchema } from './jarvis-actions.js'
const input = {
  householdId: 'home',
  sessionId: 'dd1c7fd9-389b-42c1-b103-bceddf3686ae',
  idempotencyKey: 'd9db0257-6e79-424f-b6b4-0d6b141aa80d',
  action: {
    type: 'CREATE_EXPENSE',
    payload: {
      accountId: 'alpha',
      categoryId: 'fuel',
      amountMinor: 2800,
      currency: 'EUR',
      description: ' Fuel ',
      transactionDate: '2026-10-19T12:00:00Z',
    },
  },
}
describe('strict Jarvis action contracts', () => {
  it('accepts integer minor units and canonicalizes text', () => {
    expect(jarvisPrepareActionSchema.parse(input).action.payload).toMatchObject({
      description: 'Fuel',
      amountMinor: 2800,
    })
  })
  it.each([
    { amountMinor: 0 },
    { amountMinor: -1 },
    { amountMinor: 1.5 },
    { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { currency: 'eur' },
    { currency: 'EURO' },
    { accountId: '' },
    { categoryId: '' },
    { accountId: 'other/accounts/alpha' },
    { ownerUserId: 'attacker' },
    { source: 'BANK' },
    { createdBy: 'attacker' },
    { householdId: 'other' },
    { confirmed: true },
    { transactionDate: '2026-02-30' },
  ])('rejects invalid or authority-bearing expense fields: %j', (fields) => {
    expect(
      jarvisPrepareActionSchema.safeParse({
        ...input,
        action: { ...input.action, payload: { ...input.action.payload, ...fields } },
      }).success,
    ).toBe(false)
  })
  it.each(['amountMinor', 'currency', 'accountId', 'categoryId', 'transactionDate', 'description'])(
    'requires %s',
    (key) => {
      const payload: Record<string, unknown> = { ...input.action.payload }
      delete payload[key]
      expect(
        jarvisPrepareActionSchema.safeParse({ ...input, action: { ...input.action, payload } })
          .success,
      ).toBe(false)
    },
  )
  it('rejects unknown envelope keys and arbitrary confirmation objects', () => {
    expect(jarvisPrepareActionSchema.safeParse({ ...input, uid: 'attacker' }).success).toBe(false)
    expect(
      jarvisActionReferenceSchema.safeParse({ ...input, proposalId: 'a'.repeat(64) }).success,
    ).toBe(false)
  })
  it.each([
    { title: 'Task', extra: true },
    { title: 'Task', status: 'DONE' },
    { title: 'Task', dueDate: '2026-02-30' },
    {
      title: 'Task',
      recurrence: { frequency: 'DAILY', interval: 1, endType: 'NEVER', extra: true },
      dueDate: '2026-10-20',
    },
    { title: 'Task', dueTime: '10:00' },
    { title: 'Task', listId: 'other/lists/one' },
  ])('validates nested task payloads strictly: %j', (payload) => {
    expect(
      jarvisPrepareActionSchema.safeParse({ ...input, action: { type: 'CREATE_TASK', payload } })
        .success,
    ).toBe(false)
  })
  it('requires versions for task changes and valid local schedule dates', () => {
    for (const action of [
      { type: 'COMPLETE_TASK', payload: { taskId: 't1' } },
      {
        type: 'RESCHEDULE_TASK',
        payload: { taskId: 't1', expectedVersion: 1, dueDate: '2026-02-30', dueTime: null },
      },
    ])
      expect(jarvisPrepareActionSchema.safeParse({ ...input, action }).success).toBe(false)
  })
})
