import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test/render'
import { TransactionForm } from './TransactionForm'

vi.mock('../../hooks/useHouseholdData', () => ({
  useAccounts: () => ({
    data: [
      { id: 'a1', ownerUserId: 'u1', name: 'Eurobank', isArchived: false },
      { id: 'a2', ownerUserId: 'u1', name: 'Cash', isArchived: false },
    ],
  }),
  useMembers: () => ({ data: [{ userId: 'u1', displayName: 'Emmanouil' }] }),
  useCategories: () => ({
    data: [{ id: 'c1', name: 'Supermarket', type: 'EXPENSE', isArchived: false }],
  }),
}))
vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: 'h1', defaultCurrency: 'EUR' } }),
}))
vi.mock('../../lib/callables', () => ({
  api: { createTransaction: vi.fn(), updateTransaction: vi.fn() },
}))

describe('TransactionForm', () => {
  it('starts with the fast expense fields', () => {
    renderApp(<TransactionForm onSaved={() => undefined} />)
    expect(screen.getByLabelText('Amount')).toHaveFocus()
    expect(screen.getByLabelText('Account', { selector: 'input' })).toBeVisible()
    expect(screen.getByLabelText('Category', { selector: 'input' })).toBeVisible()
  })

  it('renders one-document transfer fields without expense categories', () => {
    const date = new Date('2026-09-18T10:00:00Z')
    renderApp(
      <TransactionForm
        transaction={{
          id: 't1',
          householdId: 'h1',
          type: 'TRANSFER',
          amountMinor: 1000,
          currency: 'EUR',
          description: 'Cash withdrawal',
          transactionDate: date,
          transfer: { sourceAccountId: 'a1', destinationAccountId: 'a2' },
          source: 'MANUAL',
          createdBy: 'u1',
          searchPrefixes: [],
          isDeleted: false,
          createdAt: date,
          updatedAt: date,
        }}
        onSaved={() => undefined}
      />,
    )
    expect(screen.getByLabelText('From account', { selector: 'input' })).toBeVisible()
    expect(screen.getByLabelText('To account', { selector: 'input' })).toBeVisible()
    expect(screen.queryByLabelText('Category', { selector: 'input' })).not.toBeInTheDocument()
  })
})
