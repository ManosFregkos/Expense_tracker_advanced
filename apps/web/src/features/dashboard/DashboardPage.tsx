import {
  Badge,
  Card,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, monthKey, netCashflow } from '@family-expense-tracker/shared'
import { Amount } from '../../components/Amount'
import { EmptyState } from '../../components/EmptyState'
import {
  useAccounts,
  useCategories,
  useLatestTransactions,
  useMembers,
  useMonthlyAnalytics,
  useReviewBankTransactions,
} from '../../hooks/useHouseholdData'
import { formatDate } from '../../lib/date'
import { useHousehold } from '../households/HouseholdProvider'
import { useAddTransaction } from '../transactions/AddTransactionProvider'
import { DashboardTasksWidget } from '../tasks/components/DashboardTasksWidget'

const COLORS = ['#145f52', '#2f8b7b', '#63b6a8', '#e4b85c', '#c47b54', '#758d88']

export function DashboardPage() {
  const { household } = useHousehold()
  const analytics = useMonthlyAnalytics()
  const transactions = useLatestTransactions()
  const accounts = useAccounts()
  const categories = useCategories()
  const members = useMembers()
  const add = useAddTransaction()
  const review = useReviewBankTransactions()
  if (!household) return null
  const currentKey = monthKey(new Date(), household.timeZone)
  const current = analytics.data?.find((item) => item.monthKey === currentKey)
  const currency = household.defaultCurrency
  const metrics = [
    { label: 'Income', value: current?.incomeMinor ?? 0, className: 'amount-income' },
    { label: 'Expenses', value: current?.expenseMinor ?? 0, className: 'amount-expense' },
    {
      label: 'Net cashflow',
      value: current ? netCashflow(current) : 0,
      className: (current ? netCashflow(current) : 0) >= 0 ? 'amount-income' : 'amount-expense',
    },
  ]
  const categoryData = Object.entries(current?.byCategory ?? {})
    .map(([id, value]) => ({
      name: categories.data?.find((category) => category.id === id)?.name ?? 'Other',
      value,
    }))
    .sort((a, b) => b.value - a.value)
  const memberData = Object.entries(current?.byMember ?? {}).map(([id, value]) => ({
    name: members.data?.find((member) => member.userId === id)?.displayName ?? 'Member',
    value,
  }))
  const trend = [...(analytics.data ?? [])]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-6)
    .map((item) => ({
      month: item.monthKey,
      income: item.incomeMinor / 100,
      expenses: item.expenseMinor / 100,
    }))
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(),
  )
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Text c="dimmed" size="sm">
            {monthLabel}
          </Text>
          <Title order={1}>Welcome back</Title>
          <Text c="dimmed">Here is how {household.name} is doing this month.</Text>
        </div>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        {metrics.map((metric) => (
          <Card key={metric.label} className="metric-card" padding="lg">
            <Text c="dimmed" size="sm" fw={600}>
              {metric.label}
            </Text>
            {analytics.isLoading ? (
              <Skeleton h={35} mt="sm" />
            ) : (
              <Text className={metric.className} fz={28} fw={750} mt={4}>
                {formatMoney(metric.value, currency)}
              </Text>
            )}
          </Card>
        ))}
      </SimpleGrid>
      {(review.data?.length ?? 0) > 0 && (
        <Paper withBorder p="md" mb="lg" style={{ borderColor: '#e4b85c' }}>
          <Group justify="space-between">
            <div>
              <Text fw={700}>Transactions to review: {review.data?.length}</Text>
              <Text size="sm" c="dimmed">
                Resolve possible duplicates or choose categories.
              </Text>
            </div>
            <Text component="a" href="/transactions/review" c="teal.9" fw={700}>
              Review now
            </Text>
          </Group>
        </Paper>
      )}
      <Grid>
        <Grid.Col span={12}>
          <DashboardTasksWidget />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper withBorder p="lg" h="100%">
            <Title order={3} mb="md">
              Income vs expenses
            </Title>
            <div className="chart-wrap">
              {trend.length ? (
                <ResponsiveContainer>
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis width={48} />
                    <Tooltip
                      formatter={(value) => formatMoney(Math.round(Number(value) * 100), currency)}
                    />
                    <Bar dataKey="income" fill="#2f8b7b" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="expenses" fill="#c47b54" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No trend yet"
                  message="Add your first income or expense to start the monthly trend."
                  actionLabel="Add transaction"
                  onAction={add.open}
                />
              )}
            </div>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper withBorder p="lg" h="100%">
            <Title order={3}>Expenses by category</Title>
            <div className="chart-wrap">
              {categoryData.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No expenses" message="This month has no expense data." />
              )}
            </div>
            <Stack gap={5}>
              {categoryData.slice(0, 4).map((item, index) => (
                <Group key={item.name} justify="space-between">
                  <Group gap={8}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 9,
                        background: COLORS[index % COLORS.length],
                      }}
                    />
                    <Text size="sm">{item.name}</Text>
                  </Group>
                  <Text size="sm" fw={600}>
                    {formatMoney(item.value, currency)}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper withBorder p="lg">
            <Group justify="space-between" mb="md">
              <Title order={3}>Latest transactions</Title>
              <Text component="a" href="/transactions" size="sm" c="teal.9">
                View all
              </Text>
            </Group>
            {transactions.data?.transactions.length ? (
              <Table.ScrollContainer minWidth={560}>
                <Table verticalSpacing="sm">
                  <Table.Tbody>
                    {transactions.data.transactions.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Text fw={600}>{item.description}</Text>
                          <Text size="xs" c="dimmed">
                            {formatDate(item.transactionDate)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="gray">
                            {item.type.replace('_', ' ')}
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
              </Table.ScrollContainer>
            ) : (
              <EmptyState
                title="No transactions"
                message="Your most recent transactions will appear here."
                actionLabel="Add transaction"
                onAction={add.open}
              />
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper withBorder p="lg" h="100%">
            <Title order={3} mb="md">
              Spending by member
            </Title>
            <div style={{ width: '100%', height: 220 }}>
              {memberData.length ? (
                <ResponsiveContainer>
                  <AreaChart data={memberData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis width={48} />
                    <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                    <Area type="monotone" dataKey="value" stroke="#145f52" fill="#b7ddd6" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No member data" message="Expense ownership will appear here." />
              )}
            </div>
            <Title order={4} mt="md" mb="xs">
              Accounts
            </Title>
            {(accounts.data ?? [])
              .filter((account) => !account.isArchived)
              .slice(0, 5)
              .map((account) => (
                <Group key={account.id} justify="space-between" py={6}>
                  <div>
                    <Text size="sm" fw={600}>
                      {account.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {
                        members.data?.find((member) => member.userId === account.ownerUserId)
                          ?.displayName
                      }
                    </Text>
                  </div>
                  <Text size="sm" fw={650}>
                    {formatMoney(
                      account.appCalculatedBalanceMinor ?? account.currentBalanceMinor,
                      account.currency,
                    )}
                  </Text>
                </Group>
              ))}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  )
}
