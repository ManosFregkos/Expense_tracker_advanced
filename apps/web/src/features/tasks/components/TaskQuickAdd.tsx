import { Button, Group, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../../lib/callables'
import { friendlyError } from '../../../lib/errors'
import { useHousehold } from '../../households/HouseholdProvider'
import { useInvalidateTasks } from '../hooks'

export function TaskQuickAdd({ onCreated }: { onCreated?(taskId: string): void }) {
  const { household } = useHousehold()
  const [title, setTitle] = useState('')
  const invalidate = useInvalidateTasks()
  const mutation = useMutation({
    mutationFn: ({
      taskTitle,
      clientRequestId,
    }: {
      taskTitle: string
      clientRequestId: string
    }) => {
      if (!household) throw new Error('No household selected')
      return api.createTask({
        householdId: household.id,
        title: taskTitle,
        clientRequestId,
        status: 'TODO',
        priority: 'NONE',
        tags: [],
      })
    },
    onSuccess: async ({ taskId }) => {
      setTitle('')
      await invalidate(taskId)
      notifications.show({
        color: 'teal',
        message: 'Task created.',
      })
      onCreated?.(taskId)
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        title: 'Could not create task',
        message: friendlyError(error),
      }),
  })
  const submit = () => {
    const value = title.trim()
    if (!value || !household) return
    const clientRequestId = crypto.randomUUID()
    if (!navigator.onLine) {
      const key = 'offline-task-queue'
      const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{
        householdId: string
        title: string
        clientRequestId: string
      }>
      existing.push({ householdId: household.id, title: value, clientRequestId })
      localStorage.setItem(key, JSON.stringify(existing))
      setTitle('')
      notifications.show({
        color: 'yellow',
        message: 'Offline. Task will sync when connection returns.',
      })
      return
    }
    mutation.mutate({ taskTitle: value, clientRequestId })
  }
  return (
    <Group align="flex-end" wrap="nowrap" className="quick-add">
      <TextInput
        aria-label="Quick task title"
        placeholder="Quick task"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
        maxLength={200}
        style={{ flex: 1, minWidth: 0 }}
      />
      <Button onClick={submit} loading={mutation.isPending} disabled={!title.trim()}>
        Add
      </Button>
    </Group>
  )
}
