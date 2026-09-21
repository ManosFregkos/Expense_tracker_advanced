import { ActionIcon, Badge, Checkbox, Group, Paper, Stack, Text, Tooltip } from '@mantine/core'
import { IconGripVertical, IconRepeat } from '@tabler/icons-react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import {
  isTaskOverdue,
  type HouseholdMember,
  type HouseholdTask,
  type TaskList,
} from '@family-expense-tracker/shared'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { useTaskStatusMutation } from '../hooks'

export function TaskRow({
  task,
  members,
  lists,
  timeZone,
  draggable,
  onOpen,
}: {
  task: HouseholdTask
  members: HouseholdMember[]
  lists: TaskList[]
  timeZone: string
  draggable: boolean
  onOpen(): void
}) {
  const status = useTaskStatusMutation(task)
  const sortable = useSortable({ id: task.id, disabled: !draggable })
  const member = members.find((item) => item.userId === task.assigneeUserId)
  const completedBy = members.find((item) => item.userId === task.completedBy)
  const list = lists.find((item) => item.id === task.listId)
  const overdue = isTaskOverdue(task, new Date(), timeZone)
  return (
    <Paper
      ref={sortable.setNodeRef}
      withBorder
      p="sm"
      className="task-row"
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.65 : 1,
      }}
      onClick={onOpen}
    >
      <Group wrap="nowrap" align="flex-start">
        {draggable && (
          <Tooltip label="Drag to reorder">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Reorder ${task.title}`}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <IconGripVertical size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        <Checkbox
          size="md"
          mt={2}
          checked={task.status === 'DONE' || status.isPending}
          disabled={status.isPending || task.status === 'CANCELLED'}
          aria-label={task.status === 'DONE' ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => status.mutate()}
        />
        <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={650} td={task.status === 'DONE' ? 'line-through' : undefined}>
              {task.title}
            </Text>
            {task.status === 'IN_PROGRESS' && <Badge variant="light">In progress</Badge>}
            {task.status === 'CANCELLED' && <Badge color="gray">Cancelled</Badge>}
            <TaskPriorityBadge priority={task.priority} />
            {task.recurrence && <IconRepeat size={15} aria-label="Recurring" />}
          </Group>
          <Group gap="xs" c="dimmed">
            {task.dueDate && (
              <Text size="xs" c={overdue ? 'red.7' : undefined} fw={overdue ? 650 : undefined}>
                {overdue ? 'Overdue · ' : ''}
                {task.dueDate}
                {task.dueTime ? ` at ${task.dueTime}` : ''}
              </Text>
            )}
            {task.status === 'DONE' && task.completedAt && (
              <Text size="xs">Completed by {completedBy?.displayName ?? 'Household member'}</Text>
            )}
            <Text size="xs">{member?.displayName ?? task.assigneeDisplayName ?? 'Unassigned'}</Text>
            {list && <Text size="xs">· {list.name}</Text>}
          </Group>
        </Stack>
      </Group>
    </Paper>
  )
}
