import { Alert, Button, Divider, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccounts, useCategories, useMembers } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { householdKeys } from '../../lib/query-keys'
import { listTransactions } from '../../lib/repositories'
import { downloadCsv, transactionsToCsv } from '../../utils/csv'
import { useHousehold } from '../households/HouseholdProvider'

export function SettingsPage() {
  const { household } = useHousehold()
  const members = useMembers()
  const accounts = useAccounts()
  const categories = useCategories()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(household?.name ?? '')
  const [timeZone, setTimeZone] = useState(
    household?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [confirmation, setConfirmation] = useState('')
  const [exporting, setExporting] = useState(false)
  const update = useMutation({
    mutationFn: () =>
      api.updateHousehold({
        householdId: household!.id,
        name,
        defaultCurrency: household!.defaultCurrency,
        timeZone,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: householdKeys.all })
      notifications.show({ color: 'teal', message: 'Household settings saved.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const remove = useMutation({
    mutationFn: () =>
      api.deleteHousehold({ householdId: household!.id, confirmationName: confirmation }),
    onSuccess: () => {
      localStorage.removeItem('activeHouseholdId')
      queryClient.clear()
      void navigate('/onboarding', { replace: true })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const exportData = async () => {
    if (!household) return
    setExporting(true)
    try {
      const all = []
      let cursor = undefined
      do {
        const page = await listTransactions(household.id, {
          pageSize: 200,
          ...(cursor ? { cursor } : {}),
        })
        all.push(...page.transactions)
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)
      downloadCsv(
        transactionsToCsv(all, members.data ?? [], accounts.data ?? [], categories.data ?? []),
        `${household.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-transactions.csv`,
      )
      notifications.show({ color: 'teal', message: `Exported ${all.length} transactions.` })
    } catch (error) {
      notifications.show({ color: 'red', message: friendlyError(error) })
    } finally {
      setExporting(false)
    }
  }
  if (!household) return null
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Settings</Title>
          <Text c="dimmed">Household configuration, data access, and account links.</Text>
        </div>
      </div>
      <Stack maw={760}>
        <Paper withBorder p="xl">
          <Title order={3} mb="md">
            Household
          </Title>
          <Stack>
            <TextInput
              label="Household name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Group grow>
              <TextInput label="Default currency" disabled value={household.defaultCurrency} />
              <TextInput
                label="Time zone"
                value={timeZone}
                onChange={(event) => setTimeZone(event.currentTarget.value)}
              />
            </Group>
            <Button loading={update.isPending} onClick={() => update.mutate()}>
              Save settings
            </Button>
          </Stack>
        </Paper>
        <Paper withBorder p="xl">
          <Title order={3}>Your data</Title>
          <Text c="dimmed" mt={4} mb="md">
            Download active household transactions in a portable CSV file. Amounts are exported as
            exact integer minor units.
          </Text>
          <Button variant="light" loading={exporting} onClick={() => void exportData()}>
            Export transactions CSV
          </Button>
        </Paper>
        <Paper withBorder p="xl">
          <Title order={3}>Management</Title>
          <Stack gap={4} mt="sm">
            <Button variant="subtle" justify="flex-start" onClick={() => void navigate('/members')}>
              Members and invitations
            </Button>
            <Button
              variant="subtle"
              justify="flex-start"
              onClick={() => void navigate('/categories')}
            >
              Categories
            </Button>
            <Button
              variant="subtle"
              justify="flex-start"
              onClick={() => void navigate('/bank-connections')}
            >
              Bank connections
            </Button>
            <Button variant="subtle" justify="flex-start" onClick={() => void navigate('/profile')}>
              Profile
            </Button>
          </Stack>
        </Paper>
        <Paper withBorder p="xl" style={{ borderColor: '#e5b7b7' }}>
          <Title order={3} c="red.8">
            Delete household
          </Title>
          <Alert color="red" variant="light" my="md">
            This permanently removes the household and every nested financial record. Export first.
            This action cannot be undone.
          </Alert>
          <TextInput
            label={`Type “${household.name}” to confirm`}
            value={confirmation}
            onChange={(event) => setConfirmation(event.currentTarget.value)}
          />
          <Divider my="md" />
          <Button
            color="red"
            disabled={confirmation !== household.name}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Permanently delete household
          </Button>
        </Paper>
      </Stack>
    </div>
  )
}
