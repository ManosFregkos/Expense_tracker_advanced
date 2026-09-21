import { Button, Group, Paper, Stack, Switch, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../../lib/callables'
import { friendlyError } from '../../../lib/errors'
import { enableTaskPush } from '../../../lib/messaging'
import { taskNotificationKeys } from '../../../lib/query-keys'
import { useAuth } from '../../auth/AuthProvider'
import { useHousehold } from '../../households/HouseholdProvider'
import { useTaskNotificationSettings } from '../hooks'

export function TaskNotificationSettingsCard() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const settings = useTaskNotificationSettings()
  const [dueReminders, setDueReminders] = useState(false)
  const [assignmentNotifications, setAssignmentNotifications] = useState(false)
  const [overdueReminders, setOverdueReminders] = useState(false)
  const [emailReminders, setEmailReminders] = useState(false)
  useEffect(() => {
    if (!settings.data) return
    setDueReminders(settings.data.dueReminders)
    setAssignmentNotifications(settings.data.assignmentNotifications)
    setOverdueReminders(settings.data.overdueReminders)
    setEmailReminders(settings.data.emailReminders === true)
  }, [settings.data])
  const save = useMutation({
    mutationFn: () =>
      api.updateTaskNotificationSettings({
        householdId: household!.id,
        dueReminders,
        assignmentNotifications,
        overdueReminders,
        emailReminders,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: taskNotificationKeys.settings(user!.uid, household!.id),
      })
      notifications.show({ color: 'teal', message: 'Task notification settings saved.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const push = useMutation({
    mutationFn: async () => {
      const token = await enableTaskPush()
      return api.registerDeviceToken({
        householdId: household!.id,
        token,
        platform: navigator.userAgent.slice(0, 80),
      })
    },
    onSuccess: () => notifications.show({ color: 'teal', message: 'Push notifications enabled.' }),
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  return (
    <Paper withBorder p="xl">
      <Title order={3}>Task notifications</Title>
      <Text c="dimmed" mt={4} mb="md">
        Notifications are off by default. Email reminders go to your verified sign-in email.
      </Text>
      <Stack>
        <Switch
          label="Due reminders"
          checked={dueReminders}
          onChange={(event) => setDueReminders(event.currentTarget.checked)}
        />
        <Switch
          label="Assignment notifications"
          checked={assignmentNotifications}
          onChange={(event) => setAssignmentNotifications(event.currentTarget.checked)}
        />
        <Switch
          label="One overdue reminder"
          checked={overdueReminders}
          onChange={(event) => setOverdueReminders(event.currentTarget.checked)}
        />
        <Switch
          label="Email due and overdue reminders"
          description="Receive an email even when this website is closed. Turn on the matching reminder switches above."
          checked={emailReminders}
          onChange={(event) => setEmailReminders(event.currentTarget.checked)}
        />
        <Group>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save preferences
          </Button>
          <Button variant="light" loading={push.isPending} onClick={() => push.mutate()}>
            Enable browser push
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
