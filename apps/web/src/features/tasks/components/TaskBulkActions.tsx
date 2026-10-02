import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import {
  dateKeyInTimeZone,
  type HouseholdMember,
  type HouseholdTask,
} from '@family-expense-tracker/shared'
import { useHousehold } from '../../households/HouseholdProvider'
import { runTaskBulkAction, type TaskBulkAction } from '../bulk-actions'
import { useInvalidateTasks } from '../hooks'
import { TaskSelectionContext } from '../task-selection'

export function TaskBulkActions({
  tasks,
  members,
  children,
}: {
  tasks: HouseholdTask[]
  members: HouseholdMember[]
  children: ReactNode
}) {
  const { household } = useHousehold()
  const invalidate = useInvalidateTasks()
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set<string>())
  const [dialog, setDialog] = useState<'assign' | 'reschedule' | null>(null)
  const [assignee, setAssignee] = useState('unassigned')
  const [dueDate, setDueDate] = useState('')
  const [setTime, setSetTime] = useState(false)
  const [dueTime, setDueTime] = useState('')
  const [processed, setProcessed] = useState(0)
  const [totalToProcess, setTotalToProcess] = useState(0)
  const [failures, setFailures] = useState<
    Array<{ taskId: string; title: string; message: string }>
  >([])
  const eligible = tasks.filter((task) => task.status === 'TODO' || task.status === 'IN_PROGRESS')
  const selected = eligible.filter((task) => selectedIds.has(task.id))
  const mutation = useMutation({
    mutationFn: (action: TaskBulkAction) =>
      runTaskBulkAction(household!.id, selected, action, setProcessed),
    onSuccess: async (result) => {
      setSelectedIds(new Set(result.failures.map((failure) => failure.taskId)))
      setFailures(result.failures)
      setDialog(null)
      await invalidate()
      notifications.show({
        color: result.failures.length ? 'orange' : 'teal',
        title: result.failures.length ? 'Some tasks need attention' : 'Tasks updated',
        message: `${result.succeededIds.length} updated${result.failures.length ? `, ${result.failures.length} failed. Failed tasks remain selected.` : '.'}`,
      })
    },
  })
  const run = (action: TaskBulkAction) => {
    setProcessed(0)
    setTotalToProcess(selected.length)
    setFailures([])
    mutation.mutate(action)
  }
  const toggle = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const today = dateKeyInTimeZone(new Date(), household?.timeZone ?? 'UTC')
  const shortcut = (days: number) => {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    setDueDate(date.toISOString().slice(0, 10))
  }
  return (
    <Stack gap="md">
      {eligible.length > 0 &&
        (selecting ? (
          <Paper withBorder p="sm" aria-label="Bulk task actions">
            <Stack gap="sm">
              <Group justify="space-between">
                <Checkbox
                  label="Select all on this page"
                  checked={selected.length === eligible.length}
                  indeterminate={selected.length > 0 && selected.length < eligible.length}
                  disabled={mutation.isPending}
                  onChange={() =>
                    setSelectedIds(
                      selected.length === eligible.length
                        ? new Set()
                        : new Set(eligible.map((task) => task.id)),
                    )
                  }
                />
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setSelecting(false)
                    setSelectedIds(new Set())
                    setFailures([])
                  }}
                >
                  Cancel selection
                </Button>
              </Group>
              <Text size="sm" aria-live="polite">
                {mutation.isPending
                  ? `Updating tasks… ${processed} / ${totalToProcess}`
                  : `${selected.length} selected`}
              </Text>
              <Group gap="xs">
                <Button
                  size="sm"
                  disabled={!selected.length || mutation.isPending}
                  onClick={() => run({ type: 'complete' })}
                >
                  Complete selected
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  disabled={!selected.length || mutation.isPending}
                  onClick={() => {
                    setAssignee('unassigned')
                    setDialog('assign')
                  }}
                >
                  Assign selected
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  disabled={!selected.length || mutation.isPending}
                  onClick={() => {
                    setDueDate('')
                    setSetTime(false)
                    setDueTime('')
                    setDialog('reschedule')
                  }}
                >
                  Reschedule selected
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : (
          <Group justify="flex-end">
            <Button variant="light" size="sm" onClick={() => setSelecting(true)}>
              Select tasks
            </Button>
          </Group>
        ))}
      {failures.length > 0 && (
        <Alert color="orange" title="These tasks were not updated">
          <Stack gap="xs">
            {failures.map((failure) => (
              <Text size="sm" key={failure.taskId}>
                {failure.title}: {failure.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
      <TaskSelectionContext.Provider
        value={selecting ? { selectedIds, busy: mutation.isPending, onToggle: toggle } : undefined}
      >
        {children}
      </TaskSelectionContext.Provider>
      <Modal
        opened={dialog !== null}
        onClose={() => !mutation.isPending && setDialog(null)}
        title={dialog === 'assign' ? 'Assign selected tasks' : 'Reschedule selected tasks'}
        centered
        closeOnClickOutside={!mutation.isPending}
        closeOnEscape={!mutation.isPending}
        withCloseButton={!mutation.isPending}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (mutation.isPending || !selected.length) return
            if (dialog === 'assign')
              run({ type: 'assign', assigneeUserId: assignee === 'unassigned' ? null : assignee })
            else if (dueDate)
              run({ type: 'reschedule', dueDate, ...(setTime ? { dueTime: dueTime || null } : {}) })
          }}
        >
          <Stack>
            <Text size="sm">Apply to {selected.length} selected tasks.</Text>
            {dialog === 'assign' ? (
              <Select
                label="Assign to"
                searchable
                allowDeselect={false}
                value={assignee}
                disabled={mutation.isPending}
                onChange={(value) => value && setAssignee(value)}
                data={[
                  { value: 'unassigned', label: 'Unassigned' },
                  ...members.map((member) => ({ value: member.userId, label: member.displayName })),
                ]}
              />
            ) : (
              <>
                <TextInput
                  label="New due date"
                  type="date"
                  required
                  value={dueDate}
                  disabled={mutation.isPending}
                  onChange={(event) => setDueDate(event.currentTarget.value)}
                />
                <Group gap="xs">
                  {[
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: 'Next week', days: 7 },
                  ].map((item) => (
                    <Button
                      key={item.label}
                      type="button"
                      size="compact-xs"
                      variant="light"
                      disabled={mutation.isPending}
                      onClick={() => shortcut(item.days)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Group>
                <Checkbox
                  label="Set the same time for all selected tasks"
                  checked={setTime}
                  disabled={mutation.isPending}
                  onChange={(event) => setSetTime(event.currentTarget.checked)}
                />
                {setTime && (
                  <TextInput
                    label="New due time"
                    type="time"
                    description="Leave empty for an all-day task."
                    value={dueTime}
                    disabled={mutation.isPending}
                    onChange={(event) => setDueTime(event.currentTarget.value)}
                  />
                )}
                <Text size="xs" c="dimmed">
                  {setTime
                    ? 'Existing reminder offsets and repeat settings are kept.'
                    : 'Each task keeps its due time, reminder offset, and repeat settings.'}
                </Text>
              </>
            )}
            <Button
              type="submit"
              loading={mutation.isPending}
              disabled={!selected.length || (dialog === 'reschedule' && !dueDate)}
            >
              Apply changes
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
