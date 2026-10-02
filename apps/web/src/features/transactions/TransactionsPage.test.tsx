import type * as mantine from '@mantine/core'
import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { dateRangeForMonth, dateRangeForPreset } from '@family-expense-tracker/shared'
import { renderApp } from '../../test/render'
import { historyMonths } from '../../lib/date'
import { listTransactions } from '../../lib/repositories'
import { TransactionsPage } from './TransactionsPage'

vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: 'h1', timeZone: 'Europe/Athens' } }),
}))
vi.mock('./AddTransactionProvider', () => ({
  useAddTransaction: () => ({ open: vi.fn() }),
}))
vi.mock('../../hooks/useHouseholdData', () => ({
  useAccounts: () => ({ data: [] }),
  useCategories: () => ({ data: [] }),
  useMembers: () => ({ data: [] }),
}))
vi.mock('../../lib/repositories', () => ({
  listTransactions: vi.fn(async () => ({ transactions: [], hasMore: false })),
}))
vi.mock('../../lib/callables', () => ({
  api: {
    getTransactionTotals: vi.fn(async () => ({
      transactionCount: 32,
      byCurrency: [{ currency: 'EUR', incomeMinor: 10000, expenseMinor: 3100, netMinor: 6900 }],
    })),
  },
}))

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

describe('TransactionsPage history', () => {
  it('queries the month one year ago from a dashboard link', async () => {
    const month = historyMonths('Europe/Athens')[12]!.value
    renderApp(
      <MemoryRouter initialEntries={[`/transactions?period=${month}&type=EXPENSE`]}>
        <TransactionsPage />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(listTransactions).toHaveBeenCalledWith('h1', {
        ...dateRangeForMonth(month, 'Europe/Athens'),
        type: 'EXPENSE',
        pageSize: 25,
      }),
    )
    expect(await screen.findByText('No transactions found')).toBeVisible()
  })

  it('queries a full twelve months across calendar years', async () => {
    renderApp(
      <MemoryRouter initialEntries={['/transactions?period=LAST_12_MONTHS']}>
        <TransactionsPage />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(listTransactions).toHaveBeenCalledWith('h1', {
        ...dateRangeForPreset('LAST_12_MONTHS', new Date(), 'Europe/Athens'),
        pageSize: 25,
      }),
    )
  })
})
