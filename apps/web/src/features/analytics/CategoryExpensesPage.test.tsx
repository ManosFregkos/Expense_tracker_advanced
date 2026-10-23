import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { renderApp } from '../../test/render'
import { historyMonths, formatDate } from '../../lib/date'
import { listTransactions } from '../../lib/repositories'
import { CategoryExpensesPage } from './CategoryExpensesPage'

vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: 'h1', timeZone: 'UTC', defaultCurrency: 'EUR' } }),
}))
vi.mock('../../hooks/useHouseholdData', () => ({
  useCategories: () => ({
    data: [
      { id: 'card', name: 'Credit Card Statements', type: 'EXPENSE' },
      { id: 'zero', name: 'Zero spending', type: 'EXPENSE' },
      { id: 'small', name: 'Small expense', type: 'EXPENSE' },
    ],
  }),
  useMonthlyAnalytics: () => ({
    data: [
      { monthKey: historyMonths('UTC')[0]!.value, byCategory: { card: 2500, zero: 0, small: 1 } },
    ],
  }),
}))
vi.mock('recharts', () => ({
  ResponsiveContainer: () => null,
  Cell: () => null,
  Pie: () => null,
  PieChart: () => null,
  Tooltip: () => null,
}))
vi.mock('../../lib/repositories', () => ({ listTransactions: vi.fn() }))

it('hides zero totals and loads all pages on expansion, including category split amounts', async () => {
  const date = new Date('2026-10-10T12:00:00Z')
  const common = { type: 'EXPENSE', currency: 'EUR', transactionDate: date, categoryId: 'card' }
  vi.mocked(listTransactions)
    .mockResolvedValueOnce({
      transactions: [
        { ...common, id: '1', description: 'Card payment', amountMinor: 1500 },
        {
          ...common,
          id: 'excluded',
          description: 'Excluded expense',
          amountMinor: 300,
          excludeFromAnalytics: true,
        },
      ],
      cursor: { id: 'cursor' },
      hasMore: true,
    } as never)
    .mockResolvedValueOnce({
      transactions: [
        {
          ...common,
          id: '2',
          categoryId: 'other',
          description: 'Split purchase',
          amountMinor: 5000,
          splits: [
            { categoryId: 'card', amountMinor: 1000 },
            { categoryId: 'other', amountMinor: 4000 },
          ],
        },
      ],
      hasMore: false,
    } as never)
  renderApp(
    <MemoryRouter>
      <CategoryExpensesPage />
    </MemoryRouter>,
  )
  expect(screen.queryByText('Zero spending')).not.toBeInTheDocument()
  expect(screen.getByText('Small expense')).toBeVisible()
  expect(listTransactions).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Credit Card Statements/ }))
  expect(await screen.findByText('Card payment')).toBeVisible()
  expect(await screen.findByText('Split purchase')).toBeVisible()
  expect(screen.getByText('€10.00')).toBeVisible()
  expect(screen.queryByText('Excluded expense')).not.toBeInTheDocument()
  expect(screen.getAllByText(formatDate(date))).toHaveLength(2)
  expect(listTransactions).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: /Credit Card Statements/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  fireEvent.click(screen.getByRole('button', { name: /Credit Card Statements/ }))
  expect(screen.getByRole('button', { name: /Credit Card Statements/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
}, 30000)
