import { Button, Select, SimpleGrid, TextInput } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { useAccounts, useCategories, useMembers } from '../../hooks/useHouseholdData'

export interface FilterValues {
  period: string
  type: string
  accountId: string
  memberId: string
  categoryId: string
  search: string
}
export function TransactionFilters({
  value,
  onChange,
}: {
  value: FilterValues
  onChange(next: FilterValues): void
}) {
  const accounts = useAccounts()
  const members = useMembers()
  const categories = useCategories()
  const [expanded, setExpanded] = useState(false)
  const activeExtra = Boolean(value.type || value.accountId || value.memberId || value.categoryId)
  const set = (key: keyof FilterValues, field: string | null) =>
    onChange({ ...value, [key]: field ?? '' })
  return (
    <SimpleGrid
      className="filter-grid"
      data-expanded={expanded}
      cols={{ base: 1, xs: 2, md: 3, xl: 6 }}
      spacing="sm"
    >
      <TextInput
        label="Search"
        placeholder="Merchant or description"
        leftSection={<IconSearch size={16} />}
        value={value.search}
        onChange={(event) => set('search', event.currentTarget.value)}
      />
      <Select
        label="Period"
        value={value.period}
        onChange={(field) => set('period', field)}
        data={[
          { value: 'THIS_MONTH', label: 'This month' },
          { value: 'LAST_MONTH', label: 'Last month' },
          { value: 'LAST_3_MONTHS', label: 'Last 3 months' },
          { value: 'LAST_6_MONTHS', label: 'Last 6 months' },
          { value: 'THIS_YEAR', label: 'This year' },
        ]}
      />
      <Button
        className="mobile-only filter-toggle"
        variant="light"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? 'Hide filters' : `More filters${activeExtra ? ' • active' : ''}`}
      </Button>
      <div className="filter-extra">
        <Select
          label="Type"
          clearable
          placeholder="All types"
          value={value.type || null}
          onChange={(field) => set('type', field)}
          data={['EXPENSE', 'INCOME', 'TRANSFER'].map((type) => ({
            value: type,
            label: type.replace('_', ' '),
          }))}
        />
        <Select
          label="Account"
          searchable
          clearable
          placeholder="All accounts"
          value={value.accountId || null}
          onChange={(field) => set('accountId', field)}
          data={(accounts.data ?? []).map((account) => ({
            value: account.id,
            label: account.name,
          }))}
        />
        <Select
          label="Member"
          clearable
          placeholder="Household"
          value={value.memberId || null}
          onChange={(field) => set('memberId', field)}
          data={(members.data ?? []).map((member) => ({
            value: member.userId,
            label: member.displayName,
          }))}
        />
        <Select
          label="Category"
          searchable
          clearable
          placeholder="All categories"
          value={value.categoryId || null}
          onChange={(field) => set('categoryId', field)}
          data={(categories.data ?? []).map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />
      </div>
    </SimpleGrid>
  )
}
