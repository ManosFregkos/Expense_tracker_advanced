import { Card, Grid, Group, Paper, SimpleGrid, Table, Text, Title } from '@mantine/core'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  averageMinor,
  formatMoney,
  monthKey,
  percentageChange,
} from '@family-expense-tracker/shared'
import { EmptyState } from '../../components/EmptyState'
import {
  useAccounts,
  useCategories,
  useMembers,
  useMonthlyAnalytics,
} from '../../hooks/useHouseholdData'
import { useHousehold } from '../households/HouseholdProvider'

export function AnalyticsPage() {
  const { household } = useHousehold()
  const query = useMonthlyAnalytics()
  const categories = useCategories()
  const members = useMembers()
  const accounts = useAccounts()
  if (!household) return null
  const data = [...(query.data ?? [])].sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  const key = monthKey(new Date(), household.timeZone)
  const index = data.findIndex((item) => item.monthKey === key)
  const current = data[index]
  const previous = index > 0 ? data[index - 1] : undefined
  const recent = data.slice(-6)
  const year = key.slice(0, 4)
  const ytd = data.filter((item) => item.monthKey.startsWith(year))
  const currency = household.defaultCurrency
  const expenseChange = percentageChange(current?.expenseMinor ?? 0, previous?.expenseMinor ?? 0)
  const summaries = [
    ['Month expenses', current?.expenseMinor ?? 0],
    ['3-month average', averageMinor(data.slice(-3).map((item) => item.expenseMinor))],
    ['6-month average', averageMinor(data.slice(-6).map((item) => item.expenseMinor))],
    ['YTD income', ytd.reduce((sum, item) => sum + item.incomeMinor, 0)],
    ['YTD expenses', ytd.reduce((sum, item) => sum + item.expenseMinor, 0)],
  ] as const
  const dimensions = [
    {
      title: 'Category analysis',
      values: current?.byCategory ?? {},
      label: (id: string) => categories.data?.find((item) => item.id === id)?.name ?? 'Other',
    },
    {
      title: 'Member analysis',
      values: current?.byMember ?? {},
      label: (id: string) =>
        members.data?.find((item) => item.userId === id)?.displayName ?? 'Member',
    },
    {
      title: 'Account analysis',
      values: current?.byAccount ?? {},
      label: (id: string) => accounts.data?.find((item) => item.id === id)?.name ?? 'Account',
    },
    {
      title: 'Merchant analysis',
      values: current?.byMerchant ?? {},
      label: (id: string) => id || 'Unknown',
    },
  ]
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Analytics</Title>
          <Text c="dimmed">Descriptive trends without prescriptive budgets.</Text>
        </div>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} mb="lg">
        {summaries.map(([label, value]) => (
          <Card withBorder key={label}>
            <Text size="xs" fw={700} c="dimmed">
              {label}
            </Text>
            <Text fz="xl" fw={750} mt={5}>
              {formatMoney(value, currency)}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
      <Paper withBorder p="lg" mb="lg">
        <Group justify="space-between">
          <div>
            <Title order={3}>Month-over-month</Title>
            <Text c="dimmed" size="sm">
              Income and expense totals exclude transfers.
            </Text>
          </div>
          <Text
            fw={700}
            c={expenseChange === null ? 'gray' : expenseChange > 0 ? 'red.7' : 'teal.8'}
          >
            {expenseChange === null
              ? 'No baseline'
              : `${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}% expenses`}
          </Text>
        </Group>
        <div className="chart-wrap">
          {recent.length ? (
            <ResponsiveContainer>
              <LineChart
                data={recent.map((item) => ({
                  month: item.monthKey,
                  income: item.incomeMinor / 100,
                  expenses: item.expenseMinor / 100,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) => formatMoney(Math.round(Number(value) * 100), currency)}
                />
                <Legend />
                <Line dataKey="income" stroke="#2f8b7b" strokeWidth={3} />
                <Line dataKey="expenses" stroke="#c47b54" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Not enough history"
              message="Monthly trends appear after adding transactions."
            />
          )}
        </div>
      </Paper>
      <Grid>
        {dimensions.map((dimension) => {
          const rows = Object.entries(dimension.values).sort((a, b) => b[1] - a[1])
          return (
            <Grid.Col key={dimension.title} span={{ base: 12, lg: 6 }}>
              <Paper withBorder p="lg" h="100%">
                <Title order={3} mb="md">
                  {dimension.title}
                </Title>
                {rows.length ? (
                  <>
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer>
                        <BarChart
                          layout="vertical"
                          data={rows.slice(0, 6).map(([id, value]) => ({
                            name: dimension.label(id),
                            value: value / 100,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={95} />
                          <Tooltip
                            formatter={(value) =>
                              formatMoney(Math.round(Number(value) * 100), currency)
                            }
                          />
                          <Bar dataKey="value" fill="#338c7d" radius={[0, 5, 5, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <Table verticalSpacing="xs">
                      <Table.Tbody>
                        {rows.slice(0, 5).map(([id, value]) => (
                          <Table.Tr key={id}>
                            <Table.Td>{dimension.label(id)}</Table.Td>
                            <Table.Td ta="right" fw={650}>
                              {formatMoney(value, currency)}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </>
                ) : (
                  <EmptyState title="No data" message="No expenses match this period." />
                )}
              </Paper>
            </Grid.Col>
          )
        })}
      </Grid>
    </div>
  )
}
