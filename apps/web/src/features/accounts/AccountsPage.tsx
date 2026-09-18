import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'
import { IconDots, IconEdit, IconPlus, IconArchive } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { formatMoney, type FinancialAccount } from '@family-expense-tracker/shared'
import { EmptyState } from '../../components/EmptyState'
import { useAccounts, useMembers } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { accountKeys } from '../../lib/query-keys'
import { useHousehold } from '../households/HouseholdProvider'
import { AccountForm } from './AccountForm'

export function AccountsPage() {
  const { household } = useHousehold()
  const accounts = useAccounts()
  const members = useMembers()
  const queryClient = useQueryClient()
  const [opened, modal] = useDisclosure(false)
  const [editing, setEditing] = useState<FinancialAccount>()
  const archive = useMutation({
    mutationFn: (accountId: string) =>
      api.archiveAccount({ householdId: household!.id, accountId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all(household!.id) })
      notifications.show({ message: 'Account archived.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const openCreate = () => {
    setEditing(undefined)
    modal.open()
  }
  const openEdit = (account: FinancialAccount) => {
    setEditing(account)
    modal.open()
  }
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Accounts</Title>
          <Text c="dimmed">
            Balances are derived from opening balances and transaction effects.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={17} />} onClick={openCreate}>
          Add account
        </Button>
      </div>
      {!accounts.data?.length ? (
        <EmptyState
          title="No accounts yet"
          message="Add a bank, cash, debit-card, or credit-card account."
          actionLabel="Add account"
          onAction={openCreate}
        />
      ) : (
        <Stack gap="xl">
          {(members.data ?? []).map((member) => {
            const owned = (accounts.data ?? []).filter(
              (account) => account.ownerUserId === member.userId,
            )
            if (!owned.length) return null
            return (
              <section key={member.userId}>
                <Title order={3} mb="sm">
                  {member.displayName}
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                  {owned.map((account) => (
                    <Card
                      key={account.id}
                      withBorder
                      className="metric-card"
                      opacity={account.isArchived ? 0.6 : 1}
                    >
                      <Group justify="space-between" align="start">
                        <div>
                          <Text fw={700}>{account.name}</Text>
                          <Group gap={6} mt={6}>
                            <Badge variant="light" color="gray">
                              {account.type.replaceAll('_', ' ')}
                            </Badge>
                            {account.isArchived && <Badge color="gray">Archived</Badge>}
                          </Group>
                        </div>
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={`Actions for ${account.name}`}
                            >
                              <IconDots size={18} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={16} />}
                              onClick={() => openEdit(account)}
                            >
                              Edit
                            </Menu.Item>
                            {!account.isArchived && (
                              <Menu.Item
                                color="red"
                                leftSection={<IconArchive size={16} />}
                                onClick={() => archive.mutate(account.id)}
                              >
                                Archive
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                      <Text fz={28} fw={750} mt="xl">
                        {formatMoney(account.currentBalanceMinor, account.currency)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Opening {formatMoney(account.openingBalanceMinor, account.currency)}
                      </Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </section>
            )
          })}
        </Stack>
      )}
      <Modal opened={opened} onClose={modal.close} title={editing ? 'Edit account' : 'Add account'}>
        <AccountForm account={editing} onSaved={modal.close} />
      </Modal>
    </div>
  )
}
