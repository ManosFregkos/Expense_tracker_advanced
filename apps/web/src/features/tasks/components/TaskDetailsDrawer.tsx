import {
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { TaskCoreInput } from '@family-expense-tracker/shared'
import { api } from '../../../lib/callables'
import { formatDate } from '../../../lib/date'
import { friendlyError } from '../../../lib/errors'
import { useHousehold } from '../../households/HouseholdProvider'
import { useInvalidateTasks, useSubtasks, useTask, useTaskActivity, useTaskLists } from '../hooks'
import { SubtaskList } from './SubtaskList'
import { TaskForm } from './TaskForm'
import { TaskPriorityBadge } from './TaskPriorityBadge'

export function TaskDetailsDrawer({ taskId, onClose }: { taskId?: string; onClose(): void }) {
  const { household } = useHousehold()
  const task = useTask(taskId)
  const subtasks = useSubtasks(taskId)
  const activity = useTaskActivity(taskId)
  const lists = useTaskLists()
  const invalidate = useInvalidateTasks()
  const [editing, setEditing] = useState(false)
  const [deleteOpened, deleteModal] = useDisclosure(false)
  const mobile = useMediaQuery('(max-width: 48em)')
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { type: 'update'; values: TaskCoreInput }
        | { type: 'complete' | 'reopen' | 'cancel' | 'delete' },
    ) => {
      const current = task.data
      if (!household || !current) throw new Error('Task is unavailable')
      if (action.type === 'update')
        return api.updateTask({
          householdId: household.id,
          taskId: current.id,
          expectedVersion: current.version,
          task: action.values,
        })
      const input = { householdId: household.id, taskId: current.id }
      if (action.type === 'complete') return api.completeTask(input)
      if (action.type === 'reopen') return api.reopenTask(input)
      if (action.type === 'cancel') return api.cancelTask(input)
      return api.deleteTask(input)
    },
    onSuccess: async (_result, action) => {
      await invalidate(taskId)
      if (action.type === 'update') {
        setEditing(false)
        notifications.show({ color: 'teal', message: 'Task updated.' })
      }
      if (action.type === 'delete') onClose()
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const current = task.data
  return (
    <>
      <Drawer
        opened={Boolean(taskId)}
        onClose={onClose}
        title={editing ? 'Edit task' : 'Task details'}
        position={mobile ? 'bottom' : 'right'}
        size={mobile ? '100%' : 'lg'}
        styles={mobile ? { content: { height: '100%' } } : undefined}
      >
        {task.isLoading ? (
          <Loader />
        ) : !current ? (
          <Text c="dimmed">This task is unavailable or was deleted.</Text>
        ) : editing ? (
          <TaskForm
            task={current}
            submitting={mutation.isPending}
            onSubmit={(values) => mutation.mutate({ type: 'update', values })}
          />
        ) : (
          <ScrollArea.Autosize mah="calc(100vh - 100px)">
            <Stack>
              <div>
                <Group gap="xs" mb={4}>
                  <Badge variant="light">{current.status.replace('_', ' ')}</Badge>
                  <TaskPriorityBadge priority={current.priority} />
                </Group>
                <Title order={2}>{current.title}</Title>
                {current.description && (
                  <Text mt="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {current.description}
                  </Text>
                )}
              </div>
              <Group>
                {current.status === 'DONE' || current.status === 'CANCELLED' ? (
                  <Button variant="light" onClick={() => mutation.mutate({ type: 'reopen' })}>
                    Reopen
                  </Button>
                ) : (
                  <Button onClick={() => mutation.mutate({ type: 'complete' })}>Complete</Button>
                )}
                {current.status !== 'DONE' && current.status !== 'CANCELLED' && (
                  <Button variant="default" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
                {current.status !== 'CANCELLED' && current.status !== 'DONE' && (
                  <Button
                    variant="subtle"
                    color="gray"
                    onClick={() => mutation.mutate({ type: 'cancel' })}
                  >
                    Cancel task
                  </Button>
                )}
                <Button variant="subtle" color="red" onClick={deleteModal.open}>
                  Delete
                </Button>
              </Group>
              <Divider />
              <Stack gap={6}>
                <Text size="sm">
                  <strong>Assignee:</strong> {current.assigneeDisplayName ?? 'Unassigned'}
                </Text>
                <Text size="sm">
                  <strong>Due:</strong>{' '}
                  {current.dueDate
                    ? `${current.dueDate}${current.dueTime ? ` at ${current.dueTime}` : ''}`
                    : 'No due date'}
                </Text>
                <Text size="sm">
                  <strong>Tags:</strong> {current.tags.length ? current.tags.join(', ') : 'None'}
                </Text>
                <Text size="sm">
                  <strong>List:</strong>{' '}
                  {lists.data?.find((list) => list.id === current.listId)?.name ?? 'No list'}
                </Text>
                {current.recurrence && (
                  <Text size="sm">
                    <strong>Repeats:</strong> Every {current.recurrence.interval}{' '}
                    {current.recurrence.frequency.toLowerCase()}
                  </Text>
                )}
                {current.completedAt && (
                  <Text size="sm">
                    <strong>Completed:</strong> {formatDate(current.completedAt)}
                  </Text>
                )}
              </Stack>
              <Divider label="Checklist" labelPosition="left" />
              <SubtaskList taskId={current.id} subtasks={subtasks.data ?? []} />
              <Divider label="Activity" labelPosition="left" />
              <Stack gap="xs">
                {(activity.data ?? []).map((item) => (
                  <div key={item.id}>
                    <Text size="sm">
                      <strong>{item.userDisplayName}</strong>{' '}
                      {item.action.toLowerCase().replaceAll('_', ' ')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatDate(item.timestamp)}
                    </Text>
                  </div>
                ))}
                {!activity.data?.length && (
                  <Text size="sm" c="dimmed">
                    No activity yet.
                  </Text>
                )}
              </Stack>
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Drawer>
      <Modal opened={deleteOpened} onClose={deleteModal.close} title="Delete task?" centered>
        <Text mb="lg">
          “{current?.title}” will move to recently deleted and can be restored later.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={deleteModal.close}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ type: 'delete' })}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  )
}
