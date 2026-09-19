import { Badge, Button, Card, Group, Loader, Paper, Stack, Table, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  dateRangeForPreset,
  formatMoney,
  type TransactionType,
} from '@family-expense-tracker/shared'
import { Amount } from '../../components/Amount'
import { EmptyState } from '../../components/EmptyState'
import {
  useAccounts,
  useCategories,
  useMembers,
  usePendingBankTransactions,
} from '../../hooks/useHouseholdData'
import { formatDate } from '../../lib/date'
import { transactionKeys } from '../../lib/query-keys'
import { listTransactions, type TransactionFilters as QueryFilters } from '../../lib/repositories'
import { useHousehold } from '../households/HouseholdProvider'
import { useAddTransaction } from './AddTransactionProvider'
import { TransactionFilters, type FilterValues } from './TransactionFilters'

const PRESETS = ['THIS_MONTH', 'LAST_MONTH', 'LAST_3_MONTHS', 'LAST_6_MONTHS', 'THIS_YEAR'] as const
export function TransactionsPage() {
  const { household } = useHousehold()
  const add = useAddTransaction()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(0)
  const [cursors, setCursors] = useState<QueryFilters['cursor'][]>([undefined])
  const accounts = useAccounts()
  const categories = useCategories()
  const members = useMembers()
  const pending = usePendingBankTransactions()
  const filters: FilterValues = {
    period: params.get('period') ?? 'THIS_MONTH',
    type: params.get('type') ?? '',
    accountId: params.get('account') ?? '',
    memberId: params.get('member') ?? '',
    categoryId: params.get('category') ?? '',
    search: params.get('q') ?? '',
  }
  const queryFilters = useMemo<QueryFilters>(() => {
    const preset = PRESETS.includes(filters.period as (typeof PRESETS)[number])
      ? (filters.period as (typeof PRESETS)[number])
      : 'THIS_MONTH'
    const range = dateRangeForPreset(preset)
    return {
      start: range.start,
      end: range.end,
      ...(filters.type ? { type: filters.type as TransactionType } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      ...(cursors[page] ? { cursor: cursors[page] } : {}),
      pageSize: 25,
    }
  }, [
    filters.period,
    filters.type,
    filters.accountId,
    filters.memberId,
    filters.categoryId,
    filters.search,
    cursors,
    page,
  ])
  const result = useQuery({
    queryKey: transactionKeys.list(household?.id ?? '', { ...filters, page }),
    queryFn: () => listTransactions(household!.id, queryFilters),
    enabled: Boolean(household),
  })
  const changeFilters = (next: FilterValues) => {
    setParams(
      Object.fromEntries(
        Object.entries({
          period: next.period,
          type: next.type,
          account: next.accountId,
          member: next.memberId,
          category: next.categoryId,
          q: next.search,
        }).filter(([, value]) => value),
      ),
    )
    setPage(0)
    setCursors([undefined])
  }
  const next = () => {
    if (!result.data?.cursor) return
    setCursors((current) => {
      const copy = [...current]
      copy[page + 1] = result.data!.cursor
      return copy
    })
    setPage((current) => current + 1)
  }
  const accountName = (id?: string) => accounts.data?.find((item) => item.id === id)?.name ?? '—'
  const categoryName = (id?: string) =>
    categories.data?.find((item) => item.id === id)?.name ?? 'Transfer'
  const memberName = (id?: string) =>
    members.data?.find((item) => item.userId === id)?.displayName ?? 'Household'
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Transactions</Title>
          <Text c="dimmed">Search and review household financial activity.</Text>
        </div>
        <Button onClick={add.open}>Add transaction</Button>
      </div>
      {(pending.data?.length ?? 0) > 0 && (
        <Paper withBorder p="md" mb="lg">
          <Group justify="space-between" mb="xs">
            <Text fw={700}>Pending bank activity</Text>
            <Badge color="yellow">Not included in analytics</Badge>
          </Group>
          <Stack gap="xs">
            {pending.data?.map((item) => (
              <Group key={item.id} justify="space-between">
                <div>
                  <Text fw={600}>{item.merchantName ?? item.rawDescription}</Text>
                  <Text size="xs" c="dimmed">
                    Pending · bank synchronization
                  </Text>
                </div>
                <Text c={item.direction === 'DEBIT' ? 'red' : 'teal'}>
                  {item.direction === 'DEBIT' ? '−' : '+'}
                  {formatMoney(item.amountMinor, item.currency)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
      <Paper withBorder p="md" mb="lg">
        <TransactionFilters value={filters} onChange={changeFilters} />
      </Paper>
      {result.isLoading ? (
        <Loader />
      ) : !result.data?.transactions.length ? (
        <EmptyState
          title="No transactions found"
          message="Try different filters or add the first transaction for this period."
          actionLabel="Add transaction"
          onAction={add.open}
        />
      ) : (
        <>
          <Paper withBorder className="desktop-only">
            <Table highlightOnHover verticalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Account</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.data.transactions.map((item) => (
                  <Table.Tr
                    key={item.id}
                    onClick={() => void navigate(`/transactions/${item.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td>{formatDate(item.transactionDate)}</Table.Td>
                    <Table.Td>
                      <Text fw={600}>{item.description}</Text>
                      <Text size="xs" c="dimmed">
                        {item.merchant}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {categoryName(item.type === 'TRANSFER' ? undefined : item.categoryId)}
                    </Table.Td>
                    <Table.Td>
                      {accountName(
                        item.type === 'TRANSFER' ? item.transfer.sourceAccountId : item.accountId,
                      )}
                    </Table.Td>
                    <Table.Td>
                      {memberName(item.type === 'TRANSFER' ? undefined : item.ownerUserId)}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="gray">
                        {item.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Amount
                        amountMinor={item.amountMinor}
                        currency={item.currency}
                        type={item.type}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
          <Stack className="mobile-only">
            {result.data.transactions.map((item) => (
              <Card
                key={item.id}
                withBorder
                onClick={() => void navigate(`/transactions/${item.id}`)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text fw={650}>{item.description}</Text>
                    <Text size="xs" c="dimmed">
                      {formatDate(item.transactionDate)} ·{' '}
                      {categoryName(item.type === 'TRANSFER' ? undefined : item.categoryId)}
                    </Text>
                  </div>
                  <Amount
                    amountMinor={item.amountMinor}
                    currency={item.currency}
                    type={item.type}
                  />
                </Group>
              </Card>
            ))}
          </Stack>
          <Group justify="flex-end" mt="lg">
            <Button
              variant="default"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Text size="sm">Page {page + 1}</Text>
            <Button variant="default" disabled={!result.data.hasMore} onClick={next}>
              Next
            </Button>
          </Group>
        </>
      )}
    </div>
  )
}
