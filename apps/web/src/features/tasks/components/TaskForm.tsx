import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import {
  TASK_PRIORITIES,
  TASK_RECURRENCE_FREQUENCIES,
  TASK_STATUSES,
  dateKeyInTimeZone,
  taskCoreInputSchema,
  type HouseholdTask,
  type TaskCoreFormInput,
  type TaskCoreInput,
} from '@family-expense-tracker/shared'
import { useMembers } from '../../../hooks/useHouseholdData'
import { useHousehold } from '../../households/HouseholdProvider'
import { useTaskLists } from '../hooks'

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10)
}

function defaults(task?: HouseholdTask): TaskCoreFormInput {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'TODO',
    priority: task?.priority ?? 'NONE',
    assigneeUserId: task?.assigneeUserId ?? null,
    listId: task?.listId ?? null,
    dueDate: task?.dueDate ?? null,
    dueTime: task?.dueTime ?? null,
    reminderOffsetMinutes: task?.reminderOffsetMinutes ?? null,
    recurrence: task?.recurrence
      ? {
          frequency: task.recurrence.frequency,
          interval: task.recurrence.interval,
          daysOfWeek: task.recurrence.daysOfWeek,
          customUnit: task.recurrence.customUnit,
          endType: task.recurrence.endType,
          untilDate: task.recurrence.untilDateKey,
          maxOccurrences: task.recurrence.maxOccurrences,
        }
      : null,
    tags: task?.tags ?? [],
    sortOrder: task?.sortOrder,
    relatedTransactionId: task?.relatedTransactionId ?? null,
  }
}

export function TaskForm({
  task,
  submitting,
  onSubmit,
}: {
  task?: HouseholdTask
  submitting: boolean
  onSubmit(values: TaskCoreInput): void
}) {
  const { household } = useHousehold()
  const members = useMembers()
  const lists = useTaskLists()
  const form = useForm<TaskCoreFormInput, unknown, TaskCoreInput>({
    resolver: zodResolver(taskCoreInputSchema),
    defaultValues: defaults(task),
  })
  const recurrence = form.watch('recurrence')
  const today = dateKeyInTimeZone(new Date(), household?.timeZone ?? 'UTC')
  const dateShortcut = (value: string | null) =>
    form.setValue('dueDate', value, { shouldValidate: true })
  const todayWeekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  const weekend = addDays(today, (6 - todayWeekday + 7) % 7 || 7)
  return (
    <form onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}>
      <Stack>
        <TextInput
          label="Title"
          autoFocus
          required
          maxLength={200}
          error={form.formState.errors.title?.message}
          {...form.register('title')}
        />
        <Textarea
          label="Description"
          minRows={3}
          maxLength={4000}
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select
              label="Status"
              data={TASK_STATUSES.filter(
                (status) => !task || status === 'TODO' || status === 'IN_PROGRESS',
              ).map((status) => ({
                value: status,
                label: status.replace('_', ' '),
              }))}
              {...field}
            />
          )}
        />
        <Group grow align="flex-start" className="responsive-fields">
          <Controller
            control={form.control}
            name="assigneeUserId"
            render={({ field }) => (
              <Select
                label="Assignee"
                clearable
                placeholder="Unassigned"
                data={(members.data ?? []).map((member) => ({
                  value: member.userId,
                  label: member.displayName,
                }))}
                {...field}
              />
            )}
          />
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select
                label="Priority"
                data={TASK_PRIORITIES.map((priority) => ({
                  value: priority,
                  label: priority[0] + priority.slice(1).toLowerCase(),
                }))}
                {...field}
              />
            )}
          />
        </Group>
        <Controller
          control={form.control}
          name="listId"
          render={({ field }) => (
            <Select
              label="Task list"
              clearable
              placeholder="No list"
              data={(lists.data ?? [])
                .filter((list) => !list.isArchived || list.id === task?.listId)
                .map((list) => ({ value: list.id, label: list.name }))}
              {...field}
            />
          )}
        />
        <div>
          <Text size="sm" fw={500} mb={6}>
            Due
          </Text>
          <Group gap="xs" mb="xs">
            <Button
              type="button"
              size="compact-xs"
              variant="light"
              onClick={() => dateShortcut(today)}
            >
              Today
            </Button>
            <Button
              type="button"
              size="compact-xs"
              variant="light"
              onClick={() => dateShortcut(addDays(today, 1))}
            >
              Tomorrow
            </Button>
            <Button
              type="button"
              size="compact-xs"
              variant="light"
              onClick={() => dateShortcut(addDays(today, 7))}
            >
              Next week
            </Button>
            <Button
              type="button"
              size="compact-xs"
              variant="light"
              onClick={() => dateShortcut(weekend)}
            >
              Weekend
            </Button>
            <Button
              type="button"
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => dateShortcut(null)}
            >
              No date
            </Button>
          </Group>
          <Group grow align="flex-start" className="responsive-fields">
            <TextInput
              type="date"
              aria-label="Due date"
              error={form.formState.errors.dueDate?.message}
              value={form.watch('dueDate') ?? ''}
              onChange={(event) => form.setValue('dueDate', event.currentTarget.value || null)}
            />
            <TextInput
              type="time"
              aria-label="Due time"
              value={form.watch('dueTime') ?? ''}
              onChange={(event) => form.setValue('dueTime', event.currentTarget.value || null)}
            />
          </Group>
        </div>
        <Controller
          control={form.control}
          name="reminderOffsetMinutes"
          render={({ field }) => (
            <Select
              label="Reminder"
              clearable
              placeholder="No reminder"
              value={field.value == null ? null : String(field.value)}
              onChange={(value) => field.onChange(value == null ? null : Number(value))}
              data={[
                { value: '0', label: 'At due time' },
                { value: '10', label: '10 minutes before' },
                { value: '30', label: '30 minutes before' },
                { value: '60', label: '1 hour before' },
                { value: '1440', label: '1 day before' },
              ]}
            />
          )}
        />
        <Controller
          control={form.control}
          name="reminderOffsetMinutes"
          render={({ field }) => (
            <NumberInput
              label="Custom reminder (minutes before)"
              description="Optional; updates the preset above."
              min={0}
              max={525600}
              value={field.value ?? ''}
              onChange={(value) => field.onChange(value === '' ? null : Number(value))}
            />
          )}
        />
        <Controller
          control={form.control}
          name="tags"
          render={({ field }) => (
            <TagsInput label="Tags" placeholder="Weekend, phone, outside" maxTags={20} {...field} />
          )}
        />
        <Divider />
        <Checkbox
          label="Repeat this task"
          checked={Boolean(recurrence)}
          onChange={(event) =>
            form.setValue(
              'recurrence',
              event.currentTarget.checked
                ? { frequency: 'WEEKLY', interval: 1, endType: 'NEVER' }
                : null,
            )
          }
        />
        {recurrence && (
          <Stack>
            <Group grow align="flex-start" className="responsive-fields">
              <Controller
                control={form.control}
                name="recurrence.frequency"
                render={({ field }) => (
                  <Select
                    label="Repeat"
                    data={TASK_RECURRENCE_FREQUENCIES.map((frequency) => ({
                      value: frequency,
                      label: frequency === 'CUSTOM' ? 'Custom interval' : frequency.toLowerCase(),
                    }))}
                    {...field}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="recurrence.interval"
                render={({ field }) => <NumberInput label="Every" min={1} max={365} {...field} />}
              />
              {recurrence.frequency === 'CUSTOM' && (
                <Controller
                  control={form.control}
                  name="recurrence.customUnit"
                  render={({ field }) => (
                    <Select label="Unit" data={['DAY', 'WEEK', 'MONTH', 'YEAR']} {...field} />
                  )}
                />
              )}
            </Group>
            <Group grow align="flex-start" className="responsive-fields">
              <Controller
                control={form.control}
                name="recurrence.endType"
                render={({ field }) => (
                  <Select
                    label="Ends"
                    data={[
                      { value: 'NEVER', label: 'Never' },
                      { value: 'UNTIL_DATE', label: 'On a date' },
                      { value: 'AFTER_OCCURRENCES', label: 'After occurrences' },
                    ]}
                    {...field}
                  />
                )}
              />
              {recurrence.endType === 'UNTIL_DATE' && (
                <TextInput
                  type="date"
                  label="End date"
                  {...form.register('recurrence.untilDate')}
                />
              )}
              {recurrence.endType === 'AFTER_OCCURRENCES' && (
                <Controller
                  control={form.control}
                  name="recurrence.maxOccurrences"
                  render={({ field }) => (
                    <NumberInput label="Occurrences" min={1} max={10000} {...field} />
                  )}
                />
              )}
            </Group>
          </Stack>
        )}
        <Button type="submit" loading={submitting}>
          {task ? 'Save changes' : 'Create task'}
        </Button>
      </Stack>
    </form>
  )
}
