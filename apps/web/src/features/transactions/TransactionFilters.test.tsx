import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test/render'
import { TransactionFilters, type FilterValues } from './TransactionFilters'

vi.mock('../../hooks/useHouseholdData', () => ({
  useAccounts: () => ({ data: [{ id: 'account', name: 'Eurobank' }] }),
  useMembers: () => ({ data: [{ userId: 'member', displayName: 'Emmanouil' }] }),
  useCategories: () => ({ data: [{ id: 'category', name: 'Supermarket' }] }),
}))

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
})
