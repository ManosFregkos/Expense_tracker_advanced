import type * as mantine from '@mantine/core'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type * as dateUtils from '../../lib/date'
import { renderApp } from '../../test/render'
import { TransactionFilters, type FilterValues } from './TransactionFilters'

vi.mock('../../hooks/useHouseholdData', () => ({
  useAccounts: () => ({ data: [{ id: 'account', name: 'Eurobank' }] }),
  useMembers: () => ({ data: [{ userId: 'member', displayName: 'Emmanouil' }] }),
  useCategories: () => ({ data: [{ id: 'category', name: 'Supermarket' }] }),
}))
vi.mock('../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { timeZone: 'Europe/Athens' } }),
}))

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

describe('TransactionFilters', () => {
  it('reports search changes for URL-backed filtering', () => {
    const value: FilterValues = {
      period: 'THIS_MONTH',
      type: '',
      accountId: '',
      memberId: '',
      categoryId: '',
      search: '',
    }
    const onChange = vi.fn()
    renderApp(<TransactionFilters value={value} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'lidl' } })
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ search: 'lidl' })
  })

  it('offers a full year of history and reports a selected historical month', () => {
    const value: FilterValues = {
      period: 'THIS_MONTH',
      type: '',
      accountId: '',
      memberId: '',
      categoryId: '',
      search: '',
    }
    const onChange = vi.fn()
    renderApp(<TransactionFilters value={value} onChange={onChange} />)
    expect(screen.getByRole('option', { name: 'Last 12 months' })).toBeVisible()
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '2025-01' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...value, period: '2025-01' })
  })
})
