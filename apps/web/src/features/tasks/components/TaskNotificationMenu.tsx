import { ActionIcon, Indicator, Menu, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBell } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/callables'
import { listenForTaskMessages } from '../../../lib/messaging'
import { taskNotificationKeys } from '../../../lib/query-keys'
import { useAuth } from '../../auth/AuthProvider'
import { useTaskNotifications } from '../hooks'

export function TaskNotificationMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const items = useTaskNotifications()
  const unread = (items.data ?? []).filter((item) => !item.readAt).length
  useEffect(() => {
    let stop: () => void = () => undefined
    void listenForTaskMessages((payload) => {
      notifications.show({
        title: payload.data?.title ?? 'Task reminder',
        message: payload.data?.body ?? 'A task needs your attention.',
        color: 'teal',
      })
      void queryClient.invalidateQueries({ queryKey: taskNotificationKeys.all(user?.uid ?? '') })
    }).then((unsubscribe) => {
      stop = unsubscribe
    })
    return () => stop()
  }, [queryClient, user?.uid])
  const open = async (notificationId: string, taskId: string) => {
    await api.markTaskNotificationRead({ notificationId })
    await queryClient.invalidateQueries({ queryKey: taskNotificationKeys.all(user?.uid ?? '') })
    void navigate(`/tasks/${taskId}`)
  }
  return (
    <Menu position="bottom-end" width={320} withinPortal>
      <Menu.Target>
        <Indicator disabled={!unread} label={unread} size={17}>
          <ActionIcon variant="subtle" color="gray" aria-label="Task notifications">
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Task notifications</Menu.Label>
        {(items.data ?? []).length ? (
          items.data?.map((item) => (
            <Menu.Item key={item.id} onClick={() => void open(item.id, item.taskId)}>
              <Text size="sm" fw={item.readAt ? 400 : 700}>
                {item.title}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {item.body}
              </Text>
            </Menu.Item>
          ))
        ) : (
          <Text size="sm" c="dimmed" p="sm">
            No notifications.
          </Text>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
