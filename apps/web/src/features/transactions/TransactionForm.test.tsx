import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test/render'
import { TransactionForm } from './TransactionForm'
import { api } from '../../lib/callables'

vi.mock('../../hooks/useHouseholdData', () => ({
  useAccounts: () => ({
    data: [
      { id: 'a1', ownerUserId: 'u1', name: 'Eurobank', isArchived: false },
      { id: 'a2', ownerUserId: 'u1', name: 'Cash', isArchived: false },
    ],
  }),
  useMembers: () => ({ data: [{ userId: 'u1', displayName: 'Emmanouil' }] }),
  useCategories: () => ({
    data: [
      { id: 'c1', name: 'Supermarket', type: 'EXPENSE', isArchived: false },
      { id: 'salary', name: 'Salary', type: 'INCOME', isArchived: false },
    ],
  }),
}))
vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: 'h1', defaultCurrency: 'EUR' } }),
}))
vi.mock('../../lib/callables', () => ({
  api: { createTransaction: vi.fn(), updateTransaction: vi.fn() },
}))

describe('TransactionForm', () => {
  it('prefills a Jarvis draft for explicit review without saving or guessing an account', () => {
    localStorage.setItem('lastUsedAccountId', 'a1')
    renderApp(
      <TransactionForm
        initialDraft={{
          amount: '25.00',
          currency: 'EUR',
          description: 'Supermarket',
          date: '2026-10-09',
          accountId: null,
          categoryId: 'c1',
        }}
        onSaved={() => undefined}
      />,
    )
    expect(screen.getByLabelText('Amount')).toHaveValue('EUR 25.00')
    expect(screen.getByLabelText('Description / merchant')).toHaveValue('Supermarket')
    expect(screen.getByLabelText('Account', { selector: 'input' })).toHaveValue('')
    expect(api.createTransaction).not.toHaveBeenCalled()
    expect(screen.getByText('Save expense')).toBeInTheDocument()
    localStorage.removeItem('lastUsedAccountId')
  })
  it('starts with the fast expense fields', () => {
    renderApp(<TransactionForm onSaved={() => undefined} />)
    expect(screen.getByLabelText('Amount')).toHaveFocus()
    expect(screen.getByLabelText('Account', { selector: 'input' })).toBeVisible()
    expect(screen.getByLabelText('Category', { selector: 'input' })).toBeVisible()
  })

  it('renders income fields when editing an income transaction', () => {
    const date = new Date('2026-09-18T10:00:00Z')
    renderApp(
      <TransactionForm
        transaction={{
          id: 't1',
          householdId: 'h1',
          type: 'INCOME',
          amountMinor: 1000,
          currency: 'EUR',
          description: 'Salary',
          transactionDate: date,
          accountId: 'a1',
          ownerUserId: 'u1',
          categoryId: 'salary',
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
    expect(screen.getByLabelText('Account', { selector: 'input' })).toBeVisible()
    expect(screen.getByLabelText('Category', { selector: 'input' })).toBeVisible()
    expect(screen.getByLabelText('Received by', { selector: 'input' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save income' })).toBeVisible()
  })
})
