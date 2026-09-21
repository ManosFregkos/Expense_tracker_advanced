import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { formatMoney } from '@family-expense-tracker/shared'
import { useCategories, useReviewBankTransactions } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { toDate } from '../../lib/date'
import { friendlyError } from '../../lib/errors'
import { bankingKeys } from '../../lib/query-keys'
import { useHousehold } from '../households/HouseholdProvider'

export function ReviewTransactionsPage() {
  const { household } = useHousehold()
  const review = useReviewBankTransactions()
  const categories = useCategories()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Record<string, string | null>>({})
  const [remember, setRemember] = useState<Record<string, boolean>>({})
  const [bulkIds, setBulkIds] = useState<string[]>([])
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null)
  const action = useMutation({
    mutationFn: async (input: {
      bankTransactionId: string
      action: 'MATCH' | 'CREATE_SEPARATELY' | 'IGNORE'
      categoryId?: string
      transactionId?: string
      rulePattern?: string
    }) => {
      await api.reviewBankTransaction({
        householdId: household!.id,
        bankTransactionId: input.bankTransactionId,
        action: input.action,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.transactionId ? { transactionId: input.transactionId } : {}),
      })
      if (input.rulePattern && input.categoryId)
        await api.createMerchantRule({
          householdId: household!.id,
          matcherType: 'CONTAINS',
          pattern: input.rulePattern,
          categoryId: input.categoryId,
          priority: 0,
        })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bankingKeys.review(household!.id) })
      notifications.show({ color: 'teal', message: 'Review decision saved.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const bulk = useMutation({
    mutationFn: async () => {
      if (!bulkCategoryId) return
      await Promise.all(
        bulkIds.map((bankTransactionId) =>
          api.reviewBankTransaction({
            householdId: household!.id,
            bankTransactionId,
            action: 'CREATE_SEPARATELY',
            categoryId: bulkCategoryId,
          }),
        ),
      )
    },
    onSuccess: async () => {
      setBulkIds([])
      setBulkCategoryId(null)
      await queryClient.invalidateQueries({ queryKey: bankingKeys.review(household!.id) })
      notifications.show({ color: 'teal', message: 'Selected transactions categorized.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Review transactions</Title>
          <Text c="dimmed">Resolve possible duplicates and uncategorised bank activity.</Text>
        </div>
      </div>
      {!review.data?.length ? (
        <Card withBorder>
          <Text>No transactions need attention.</Text>
        </Card>
      ) : (
        <Stack>
          <Paper withBorder p="md">
            <Group align="end" className="mobile-stack-on-small">
              <Select
                searchable
                label="Bulk expense category"
                data={(categories.data ?? [])
                  .filter((category) => category.type === 'EXPENSE' && !category.isArchived)
                  .map((category) => ({ value: category.id, label: category.name }))}
                value={bulkCategoryId}
                onChange={setBulkCategoryId}
              />
              <Button
                disabled={!bulkCategoryId || !bulkIds.length}
                loading={bulk.isPending}
                onClick={() => bulk.mutate()}
              >
                Apply to {bulkIds.length} selected
              </Button>
            </Group>
          </Paper>
          {review.data.map((transaction) => {
            const type = transaction.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE'
            const options = (categories.data ?? [])
              .filter((category) => category.type === type && !category.isArchived)
              .map((category) => ({ value: category.id, label: category.name }))
            return (
              <Card withBorder key={transaction.id}>
                <Group justify="space-between" align="start" className="mobile-stack-on-small">
                  <div>
                    <Group className="review-transaction-heading">
                      {transaction.direction !== 'CREDIT' && (
                        <Checkbox
                          aria-label={`Select ${transaction.merchantName ?? transaction.rawDescription}`}
                          checked={bulkIds.includes(transaction.id)}
                          onChange={(event) =>
                            setBulkIds((current) =>
                              event.currentTarget.checked
                                ? [...current, transaction.id]
                                : current.filter((id) => id !== transaction.id),
                            )
                          }
                        />
                      )}
                      <Text fw={700}>{transaction.merchantName ?? transaction.rawDescription}</Text>
                      <Badge
                        color={
                          transaction.reviewReason === 'POSSIBLE_DUPLICATE' ? 'orange' : 'gray'
                        }
                      >
                        {(transaction.reviewReason ?? 'NEEDS_REVIEW').replaceAll('_', ' ')}
                      </Badge>
                    </Group>
                    <Text c="dimmed" size="sm">
                      {transaction.bookingDate
                        ? toDate(transaction.bookingDate).toLocaleDateString()
                        : 'Date unavailable'}
                    </Text>
                    {transaction.suggestedTransactionId && (
                      <Text size="sm" c="orange">
                        Possible existing transaction · confidence{' '}
                        {transaction.reconciliationScore ?? 0}
                      </Text>
                    )}
                  </div>
                  <Text fw={700}>
                    {transaction.direction === 'DEBIT' ? '−' : '+'}
                    {formatMoney(transaction.amountMinor, transaction.currency)}
                  </Text>
                </Group>
                <Group mt="md" align="end" className="mobile-stack-on-small">
                  {transaction.suggestedTransactionId && (
                    <Button
                      color="orange"
                      onClick={() =>
                        action.mutate({
                          bankTransactionId: transaction.id,
                          action: 'MATCH',
                          transactionId: transaction.suggestedTransactionId,
                        })
                      }
                    >
                      Match
                    </Button>
                  )}
                  <Select
                    searchable
                    label="Category"
                    placeholder="Choose category"
                    data={options}
                    value={selected[transaction.id] ?? null}
                    onChange={(value) =>
                      setSelected((current) => ({ ...current, [transaction.id]: value }))
                    }
                  />
                  <Button
                    disabled={!selected[transaction.id]}
                    onClick={() =>
                      action.mutate({
                        bankTransactionId: transaction.id,
                        action: 'CREATE_SEPARATELY',
                        ...(selected[transaction.id]
                          ? { categoryId: selected[transaction.id]! }
                          : {}),
                        ...(remember[transaction.id]
                          ? { rulePattern: transaction.merchantName ?? transaction.rawDescription }
                          : {}),
                      })
                    }
                  >
                    Create separately
                  </Button>
                  <Button
                    variant="subtle"
                    color="gray"
                    onClick={() =>
                      action.mutate({ bankTransactionId: transaction.id, action: 'IGNORE' })
                    }
                  >
                    Ignore
                  </Button>
                </Group>
                {transaction.direction !== 'CREDIT' && (
                  <Checkbox
                    mt="sm"
                    checked={remember[transaction.id] ?? false}
                    onChange={(event) =>
                      setRemember((current) => ({
                        ...current,
                        [transaction.id]: event.currentTarget.checked,
                      }))
                    }
                    label={`Always categorize similar ${transaction.merchantName ?? transaction.rawDescription} transactions this way`}
                  />
                )}
              </Card>
            )
          })}
        </Stack>
      )}
    </div>
  )
}
