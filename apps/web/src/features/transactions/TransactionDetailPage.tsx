import { Alert, Button, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { accountKeys, analyticsKeys, transactionKeys } from '../../lib/query-keys'
import { getTransaction } from '../../lib/repositories'
import { useHousehold } from '../households/HouseholdProvider'
import { TransactionForm } from './TransactionForm'

export function TransactionDetailPage() {
  const { transactionId = '' } = useParams()
  const { household } = useHousehold()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: transactionKeys.detail(household?.id ?? '', transactionId),
    queryFn: () => getTransaction(household!.id, transactionId),
    enabled: Boolean(household && transactionId),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteTransaction({ householdId: household!.id, transactionId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionKeys.all(household!.id) }),
        queryClient.invalidateQueries({ queryKey: accountKeys.all(household!.id) }),
        queryClient.invalidateQueries({ queryKey: analyticsKeys.monthly(household!.id) }),
      ])
      notifications.show({ message: 'Transaction moved to the recycle state.' })
      void navigate('/transactions')
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  if (query.isLoading)
    return (
      <div className="page">
        <Loader />
      </div>
    )
  if (!query.data)
    return (
      <div className="page">
        <Alert color="red">Transaction not found or you no longer have access.</Alert>
      </div>
    )
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Edit transaction</Title>
          <Text c="dimmed">
            Changes update balances, aggregates, and the audit trail atomically.
          </Text>
        </div>
      </div>
      <Paper withBorder p="xl" maw={680}>
        <Stack>
          <TransactionForm
            transaction={query.data}
            onSaved={() => void navigate('/transactions')}
          />
          <Group justify="space-between" mt="lg">
            <Button variant="subtle" color="gray" onClick={() => void navigate('/transactions')}>
              Cancel
            </Button>
            <Button
              variant="outline"
              color="red"
              loading={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Soft-delete this transaction? It can be restored by an administrator later.',
                  )
                )
                  remove.mutate()
              }}
            >
              Delete transaction
            </Button>
          </Group>
        </Stack>
      </Paper>
    </div>
  )
}
