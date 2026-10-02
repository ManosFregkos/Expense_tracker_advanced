import type * as mantine from '@mantine/core'
import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type * as dateUtils from '../../lib/date'
import { renderApp } from '../../test/render'
import { DashboardPage } from './DashboardPage'

vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({
    household: { id: 'h1', name: 'Family', timeZone: 'Europe/Athens', defaultCurrency: 'EUR' },
  }),
}))
vi.mock('../transactions/AddTransactionProvider', () => ({
  useAddTransaction: () => ({ open: vi.fn() }),
}))
vi.mock('../tasks/components/DashboardTasksWidget', () => ({ DashboardTasksWidget: () => null }))
vi.mock('recharts', () => ({
  ResponsiveContainer: () => null,
  Area: () => null,
  AreaChart: () => null,
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
  Pie: () => null,
  PieChart: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))
vi.mock('../../hooks/useHouseholdData', () => ({
  useAccounts: () => ({ data: [] }),
  useCategories: () => ({ data: [] }),
  useMembers: () => ({ data: [] }),
  useLatestTransactions: vi.fn(() => ({ data: { transactions: [] } })),
  useMonthlyAnalytics: () => ({
    data: [
      { monthKey: '2026-01', incomeMinor: 0, expenseMinor: 12345, byCategory: {}, byMember: {} },
      { monthKey: '2025-01', incomeMinor: 0, expenseMinor: 54321, byCategory: {}, byMember: {} },
    ],
  }),
}))

import { useLatestTransactions } from '../../hooks/useHouseholdData'

vi.mock('../../lib/date', async (importOriginal) => {
  const original = await importOriginal<typeof dateUtils>()
  return {
    ...original,
    historyMonths: (timeZone?: string) =>
      original.historyMonths(timeZone, new Date('2026-01-18T12:00:00Z')),
  }
})

vi.mock('@mantine/core', async (importOriginal) => {
  const original = await importOriginal<typeof mantine>()
  return {
    ...original,
    Select: ({
      label,
      value,
      data,
      onChange,
    }: {
      label: string
      value?: string
      data: { value: string; label: string }[]
      onChange(value: string): void
    }) => (
      <label>
        {label}
        <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
          {data.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    ),
  }
})

describe('DashboardPage history', () => {
  it('updates totals, transaction queries and the View all link for the selected month', () => {
    renderApp(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('€123.45')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2025-01' } })
    expect(screen.getByText('€543.21')).toBeVisible()
    expect(vi.mocked(useLatestTransactions)).toHaveBeenLastCalledWith(8, '2025-01')
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/transactions?period=2025-01',
    )
  })
})
