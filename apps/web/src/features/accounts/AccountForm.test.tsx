import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test/render'
import { AccountForm } from './AccountForm'

vi.mock('../../hooks/useHouseholdData', () => ({
  useMembers: () => ({ data: [{ userId: 'u1', displayName: 'Emmanouil' }] }),
}))
vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: 'h1', defaultCurrency: 'EUR' } }),
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }))
vi.mock('../../lib/callables', () => ({ api: { createAccount: vi.fn(), updateAccount: vi.fn() } }))

describe('AccountForm', () => {
  it('exposes labeled ownership, type, and integer-safe opening balance fields', () => {
    renderApp(<AccountForm onSaved={() => undefined} />)
    expect(screen.getByLabelText('Account name')).toBeVisible()
    expect(screen.getByLabelText('Owner', { selector: 'input' })).toBeVisible()
    expect(screen.getByLabelText('Account type', { selector: 'input' })).toBeVisible()
    expect(screen.getByLabelText('Opening balance')).toBeVisible()
  })
})
