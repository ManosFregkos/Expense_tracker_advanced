import { Button, Checkbox, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { dateKeyInTimeZone, isTaskOverdue } from '@family-expense-tracker/shared'
import { useHousehold } from '../../households/HouseholdProvider'
import { useTaskStatusMutation, useTasks } from '../hooks'

export function DashboardTasksWidget() {
  const { household } = useHousehold()
  const navigate = useNavigate()
  const todayKey = dateKeyInTimeZone(new Date(), household?.timeZone ?? 'UTC')
  const tasks = useTasks({
    view: 'today',
    todayKey,
    timeZone: household?.timeZone ?? 'UTC',
    pageSize: 10,
  })
  const active = tasks.data?.tasks ?? []
  const overdue = active.filter((task) =>
    isTaskOverdue(task, new Date(), household?.timeZone),
  ).length
  return (
    <Paper withBorder p="lg" h="100%">
      <Group justify="space-between" mb="sm">
        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">
            Today's tasks
          </Text>
          <Title order={3}>{active.length} remaining</Title>
        </div>
        {overdue > 0 && (
          <Text size="sm" c="red.7" fw={650}>
            Overdue: {overdue}
          </Text>
        )}
      </Group>
      {tasks.isLoading ? (
        <Stack>
          <Skeleton h={28} />
          <Skeleton h={28} />
          <Skeleton h={28} />
        </Stack>
      ) : active.length ? (
        <Stack gap="xs">
          {active.slice(0, 3).map((task) => (
            <DashboardTask key={task.id} task={task} />
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          No tasks for today.
        </Text>
      )}
      <Button variant="subtle" px={0} mt="md" onClick={() => void navigate('/tasks?view=today')}>
        View all
      </Button>
    </Paper>
  )
}

function DashboardTask({
  task,
}: {
  task: NonNullable<ReturnType<typeof useTasks>['data']>['tasks'][number]
}) {
  const mutation = useTaskStatusMutation(task)
  return (
    <Checkbox
      label={task.title}
      checked={mutation.isPending}
      disabled={mutation.isPending}
      onChange={() => mutation.mutate()}
      styles={{ body: { alignItems: 'center' }, label: { fontWeight: 550 } }}
    />
  )
}
