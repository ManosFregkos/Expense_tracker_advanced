import { Badge } from '@mantine/core'
import type { TaskPriority } from '@family-expense-tracker/shared'

const COLORS: Record<TaskPriority, string> = {
  NONE: 'gray',
  LOW: 'gray',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === 'NONE') return null
  return (
    <Badge size="sm" variant="light" color={COLORS[priority]}>
      {priority.toLowerCase()}
    </Badge>
  )
}
