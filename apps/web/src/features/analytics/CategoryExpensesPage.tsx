import {
  Accordion,
  Alert,
  Grid,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { dateRangeForMonth, type Transaction, formatMoney } from '@family-expense-tracker/shared'
import { EmptyState } from '../../components/EmptyState'
import { useCategories, useMonthlyAnalytics } from '../../hooks/useHouseholdData'
import { listTransactions } from '../../lib/repositories'
import { transactionKeys } from '../../lib/query-keys'
import { formatDate, historyMonths } from '../../lib/date'
import { useHousehold } from '../households/HouseholdProvider'

const COLORS = ['#145f52', '#2f8b7b', '#63b6a8', '#e4b85c', '#c47b54', '#758d88']

export function CategoryExpensesPage() {
  const { household } = useHousehold()
  const [params, setParams] = useSearchParams()
  const months = historyMonths(household?.timeZone)
  const selectedMonth = months.find((month) => month.value === params.get('month')) ?? months[0]!
  const analytics = useMonthlyAnalytics()
  const categories = useCategories()
  const [expanded, setExpanded] = useState<string[]>([])
  const timeZone = household?.timeZone ?? 'UTC'
  const transactions = useQuery({
    queryKey: transactionKeys.list(household?.id ?? '', {
      categoryBreakdown: selectedMonth.value,
      timeZone,
    }),
    enabled: Boolean(household) && expanded.length > 0,
    queryFn: async () => {
      const items: Transaction[] = []
      let cursor
      do {
        const page = await listTransactions(household!.id, {
          ...dateRangeForMonth(selectedMonth.value, timeZone),
          pageSize: 100,
          ...(cursor ? { cursor } : {}),
        })
        items.push(...page.transactions)
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)
      return items.filter(
        (item) =>
          item.type === 'EXPENSE' &&
          !item.isDeleted &&
          !item.deletedAt &&
          !item.excludeFromAnalytics,
      )
    },
  })
  if (!household) return null

  const totals =
    analytics.data?.find((item) => item.monthKey === selectedMonth.value)?.byCategory ?? {}
  const ids = new Set([
    ...(categories.data ?? [])
      .filter((category) => category.type === 'EXPENSE')
      .map((category) => category.id),
    ...Object.keys(totals),
  ])
  const data = [...ids]
    .map((id) => ({
      id,
      name: categories.data?.find((category) => category.id === id)?.name ?? 'Other',
      value: totals[id] ?? 0,
    }))
    .filter((item) => item.value !== 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }))
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const currency = household.defaultCurrency

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Expenses by category</Title>
          <Text c="dimmed">
            Expenses for {selectedMonth.label}. Expand a category to see its transactions.
          </Text>
        </div>
        <Select
          label="Month"
          data={months}
          value={selectedMonth.value}
          allowDeselect={false}
          onChange={(value) => {
            if (!value) return
            setExpanded([])
            setParams((current) => {
              const next = new URLSearchParams(current)
              next.set('month', value)
              return next
            })
          }}
        />
      </div>
      {analytics.isError || categories.isError ? (
        <Alert color="red" title="Unable to load category expenses">
          Please try again later.
        </Alert>
      ) : analytics.isLoading || categories.isLoading ? (
        <Skeleton h={360} />
      ) : (
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="lg" h="100%">
              <Text c="dimmed">Total expenses</Text>
              <Text fz={28} fw={750}>
                {formatMoney(total, currency)}
              </Text>
              <div style={{ width: '100%', height: 360 }}>
                {total > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="50%"
                        outerRadius="80%"
                      >
                        {data.map((item) => (
                          <Cell key={item.id} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No expenses" message="This month has no expense data." />
                )}
              </div>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="lg">
              <Title order={2} mb="md">
                All categories
              </Title>
              {data.length ? (
                <Accordion multiple value={expanded} onChange={setExpanded}>
                  {data.map((item) => (
                    <Accordion.Item key={item.id} value={item.id}>
                      <Accordion.Control>
                        <Group justify="space-between" wrap="nowrap" pr="sm">
                          <Group gap={8} wrap="nowrap">
                            <span
                              aria-hidden="true"
                              style={{
                                width: 10,
                                height: 10,
                                flexShrink: 0,
                                borderRadius: 10,
                                background: item.color,
                              }}
                            />
                            <Text size="sm">{item.name}</Text>
                          </Group>
                          <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                            {formatMoney(item.value, currency)}
                          </Text>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        {expanded.includes(item.id) &&
                          (transactions.isError ? (
                            <Alert color="red">
                              Unable to load transactions. Please try again later.
                            </Alert>
                          ) : transactions.isPending ? (
                            <Skeleton h={80} />
                          ) : (
                            <Stack gap="sm">
                              {(transactions.data ?? []).flatMap((transaction) => {
                                const amount = transaction.splits?.length
                                  ? transaction.splits
                                      .filter((split) => split.categoryId === item.id)
                                      .reduce((sum, split) => sum + split.amountMinor, 0)
                                  : transaction.categoryId === item.id
                                    ? transaction.amountMinor
                                    : 0
                                if (!amount) return []
                                return [
                                  <Group
                                    key={transaction.id}
                                    justify="space-between"
                                    wrap="nowrap"
                                    align="flex-start"
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                                        {transaction.description}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        {formatDate(transaction.transactionDate)}
                                      </Text>
                                    </div>
                                    <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                                      {formatMoney(amount, transaction.currency)}
                                    </Text>
                                  </Group>,
                                ]
                              })}
                            </Stack>
                          ))}
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              ) : (
                <EmptyState title="No expenses" message="This month has no category expenses." />
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      )}
    </div>
  )
}
