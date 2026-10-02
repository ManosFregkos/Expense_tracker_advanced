import { Alert, Button, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import type { TransactionTotalsInput } from '@family-expense-tracker/shared'
import { Amount } from '../../components/Amount'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { transactionKeys } from '../../lib/query-keys'

export function TransactionSummary({
  input,
  defaultCurrency,
}: {
  input: TransactionTotalsInput
  defaultCurrency: string
}) {
  const result = useQuery({
    queryKey: transactionKeys.totals(input.householdId, input),
    queryFn: () => api.getTransactionTotals(input),
    enabled: Boolean(input.householdId),
  })
  const totals = result.data?.byCurrency.length
    ? result.data.byCurrency
    : [{ currency: defaultCurrency, incomeMinor: 0, expenseMinor: 0, netMinor: 0 }]
  if (result.isError)
    return (
      <Alert color="red" title="Could not load totals" mb="lg">
        <Text size="sm">{friendlyError(result.error)}</Text>
        <Button variant="light" color="red" size="xs" mt="xs" onClick={() => void result.refetch()}>
          Retry totals
        </Button>
      </Alert>
    )
  return (
    <section aria-label="Transaction totals" style={{ marginBottom: 20 }}>
      <SimpleGrid cols={3} spacing="xs">
        {[
          { label: 'Income', key: 'incomeMinor', color: 'teal.8' },
          { label: 'Expenses', key: 'expenseMinor', color: 'red.8' },
          { label: 'Net', key: 'netMinor', color: undefined },
        ].map(({ label, key, color }) => (
          <Paper withBorder p="sm" key={key} aria-label={`${label} total`}>
            <Text size="sm" c="dimmed" mb="xs">
              {label}
            </Text>
            {result.isPending ? (
              <Skeleton height={30} />
            ) : (
              <Stack gap={4}>
                {totals.map((total) => (
                  <Amount
                    key={total.currency}
                    amountMinor={total[key as 'incomeMinor' | 'expenseMinor' | 'netMinor']}
                    currency={total.currency}
                    size="xl"
                    c={color}
                    style={{ fontSize: 'clamp(0.75rem, 3.2vw, 1.5rem)', overflowWrap: 'anywhere' }}
                  />
                ))}
              </Stack>
            )}
          </Paper>
        ))}
      </SimpleGrid>
      <Text size="xs" c="dimmed" mt="xs" aria-live="polite">
        {result.isPending
          ? 'Calculating totals…'
          : `${result.data?.transactionCount ?? 0} matching transactions · All pages · Net = income − expenses`}
      </Text>
    </section>
  )
}
