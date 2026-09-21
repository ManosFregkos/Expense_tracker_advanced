import { ActionIcon, Button, Checkbox, Group, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconTrash } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { TaskSubtask } from '@family-expense-tracker/shared'
import { api } from '../../../lib/callables'
import { friendlyError } from '../../../lib/errors'
import { taskKeys } from '../../../lib/query-keys'
import { useHousehold } from '../../households/HouseholdProvider'

export function SubtaskList({ taskId, subtasks }: { taskId: string; subtasks: TaskSubtask[] }) {
  const { household } = useHousehold()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: taskKeys.subtasks(household!.id, taskId) })
  const mutation = useMutation({
    mutationFn: async (
      action:
        { type: 'create'; title: string } | { type: 'toggle' | 'delete'; subtask: TaskSubtask },
    ) => {
      if (action.type === 'create')
        return api.createSubtask({ householdId: household!.id, taskId, title: action.title })
      if (action.type === 'delete')
        return api.deleteSubtask({
          householdId: household!.id,
          taskId,
          subtaskId: action.subtask.id,
        })
      return api.updateSubtask({
        householdId: household!.id,
        taskId,
        subtaskId: action.subtask.id,
        isCompleted: !action.subtask.isCompleted,
      })
    },
    onSuccess: async () => {
      setTitle('')
      await refresh()
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  return (
    <Stack gap="xs">
      {subtasks
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((subtask) => (
          <Group key={subtask.id} wrap="nowrap">
            <Checkbox
              checked={subtask.isCompleted}
              aria-label={`Complete ${subtask.title}`}
              onChange={() => mutation.mutate({ type: 'toggle', subtask })}
              label={subtask.title}
              styles={{
                label: { textDecoration: subtask.isCompleted ? 'line-through' : undefined },
              }}
            />
            <ActionIcon
              ml="auto"
              variant="subtle"
              color="red"
              aria-label={`Delete ${subtask.title}`}
              onClick={() => mutation.mutate({ type: 'delete', subtask })}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
      <Group wrap="nowrap">
        <TextInput
          aria-label="New subtask"
          placeholder="Add a checklist item"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button
          variant="light"
          disabled={!title.trim()}
          onClick={() => mutation.mutate({ type: 'create', title: title.trim() })}
        >
          Add
        </Button>
      </Group>
    </Stack>
  )
}
