import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { BankConnection } from '@family-expense-tracker/shared'
import { useBankConnections } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { bankingKeys } from '../../lib/query-keys'
import { toDate } from '../../lib/date'
import { useHousehold } from '../households/HouseholdProvider'

const institutions = [
  { code: 'ALPHA_BANK' as const, name: 'Alpha Bank' },
  { code: 'EUROBANK' as const, name: 'Eurobank' },
  { code: 'NBG' as const, name: 'National Bank of Greece' },
]
const statusColor: Record<string, string> = {
  ACTIVE: 'teal',
  SYNCING: 'blue',
  CONNECTING: 'blue',
  STALE: 'yellow',
  REQUIRES_REAUTH: 'orange',
  ERROR: 'red',
  DISCONNECTED: 'gray',
}

export function BankConnectionsPage() {
  const { household } = useHousehold()
  const connections = useBankConnections()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<BankConnection>()
  const [opened, modal] = useDisclosure(false)
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: bankingKeys.connections(household!.id) })
  const connect = useMutation({
    mutationFn: (institutionCode: 'ALPHA_BANK' | 'EUROBANK' | 'NBG') =>
      api.createBankConnection({
        householdId: household!.id,
        institutionCode,
        returnTo: `${window.location.origin}/bank-connections`,
      }),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const refresh = useMutation({
    mutationFn: (connectionId: string) =>
      api.syncBankConnection({ householdId: household!.id, connectionId }),
    onSuccess: async () => {
      await invalidate()
      notifications.show({ color: 'teal', message: 'Bank data refreshed.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const reconnect = useMutation({
    mutationFn: (connectionId: string) =>
      api.reconnectBankConnection({
        householdId: household!.id,
        connectionId,
        returnTo: `${window.location.origin}/bank-connections`,
      }),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const disconnect = useMutation({
    mutationFn: (connectionId: string) =>
      api.disconnectBankConnection({ householdId: household!.id, connectionId }),
    onSuccess: async () => {
      await invalidate()
      modal.close()
      setConfirming(undefined)
      notifications.show({ message: 'Bank disconnected. Imported history was preserved.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Bank connections</Title>
          <Text c="dimmed">
            PSD2 bank synchronization is separate from instant application balance updates.
          </Text>
        </div>
      </div>
      <Alert color="teal" mb="lg">
        Your bank credentials are entered only in the provider or bank-hosted authorization flow.
        This app never receives them.
      </Alert>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {institutions.map((institution) => {
          const connection = connections.data?.find(
            (item) =>
              item.institutionCode === institution.code ||
              item.institutionId === institution.code ||
              item.institutionName === institution.name,
          )
          return (
            <Card withBorder key={institution.code}>
              <Group justify="space-between">
                <Title order={3}>{institution.name}</Title>
                {connection && (
                  <Badge color={statusColor[connection.status] ?? 'gray'}>
                    {connection.status.replaceAll('_', ' ')}
                  </Badge>
                )}
              </Group>
              {!connection || connection.status === 'DISCONNECTED' ? (
                <Button
                  mt="xl"
                  loading={connect.isPending}
                  onClick={() => connect.mutate(institution.code)}
                >
                  Connect
                </Button>
              ) : (
                <Stack mt="md" gap="xs">
                  <Text size="sm">Accounts: {connection.accountCount ?? 0}</Text>
                  <Text size="sm" c="dimmed">
                    Last bank sync:{' '}
                    {connection.lastSuccessfulSyncAt
                      ? toDate(connection.lastSuccessfulSyncAt).toLocaleString()
                      : 'Not completed'}
                  </Text>
                  {connection.lastErrorMessageSafe && (
                    <Alert color="orange" p="sm">
                      {connection.lastErrorMessageSafe}
                    </Alert>
                  )}
                  <Group>
                    <Button
                      variant="light"
                      loading={refresh.isPending && refresh.variables === connection.id}
                      disabled={
                        connection.status === 'SYNCING' || connection.status === 'CONNECTING'
                      }
                      onClick={() => refresh.mutate(connection.id)}
                    >
                      Refresh
                    </Button>
                    {(connection.status === 'REQUIRES_REAUTH' || connection.status === 'ERROR') && (
                      <Button
                        variant="light"
                        color="orange"
                        onClick={() => reconnect.mutate(connection.id)}
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() => {
                        setConfirming(connection)
                        modal.open()
                      }}
                    >
                      Disconnect
                    </Button>
                  </Group>
                </Stack>
              )}
            </Card>
          )
        })}
      </SimpleGrid>
      <Modal opened={opened} onClose={modal.close} title="Disconnect bank?">
        <Stack>
          <Text>
            Your imported transactions will remain in the household. Future bank updates will stop.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={modal.close}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={disconnect.isPending}
              onClick={() => confirming && disconnect.mutate(confirming.id)}
            >
              Disconnect
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
