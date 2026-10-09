import { Anchor, Paper, Stack, Text } from '@mantine/core'
import type { JarvisBriefingTasks, JarvisMorningBriefing } from '@family-expense-tracker/shared'
import { jarvisCopy, type JarvisLanguage } from './language'

export function MorningBriefing({
  briefing,
  language,
  onOpenTask,
}: {
  briefing: JarvisMorningBriefing
  language: JarvisLanguage
  onOpenTask(): void
}) {
  const copy = jarvisCopy(language)
  const tasks = (title: string, section: JarvisBriefingTasks) => (
    <Stack gap={4}>
      <Text fw={600}>{title}</Text>
      {section.tasks.length === 0 && (
        <Text size="sm">{section.truncated ? copy.missing : copy.noTasks}</Text>
      )}
      {section.tasks.map((task) => (
        <Anchor
          key={task.id}
          href={`/tasks/${encodeURIComponent(task.id)}`}
          onClick={onOpenTask}
          size="sm"
          style={{ overflowWrap: 'anywhere' }}
        >
          {task.title} · {task.dueDate} {task.dueTime ?? ''}
        </Anchor>
      ))}
      {section.truncated && (
        <Text size="xs" c="dimmed">
          {copy.partial}
        </Text>
      )}
    </Stack>
  )
  const spending = briefing.monthlySpending
  return (
    <Paper withBorder p="md" aria-label={copy.briefing}>
      <Stack gap="sm">
        <Text fw={700}>
          {copy.briefing} · {briefing.date}
        </Text>
        <Text size="xs" c="dimmed">
          {briefing.scope === 'mine' ? copy.mine : copy.household} · {briefing.timeZone}
        </Text>
        {tasks(copy.today, briefing.today)}
        {tasks(copy.overdue, briefing.overdue)}
        {tasks(
          `${copy.bills} · ${copy.through} ${briefing.upcomingBills.throughDate}`,
          briefing.upcomingBills,
        )}
        <Text size="xs" c="dimmed">
          {briefing.upcomingBills.listConfigured ? copy.billHelp : copy.noBillList}
        </Text>
        <Text fw={600}>
          {copy.spending} · {spending.month}
        </Text>
        <Text>
          {spending.available && spending.expenseMinor !== null
            ? new Intl.NumberFormat(language, {
                style: 'currency',
                currency: spending.currency,
              }).format(spending.expenseMinor / 10 ** spending.currencyMinorDigits)
            : copy.missing}
        </Text>
      </Stack>
    </Paper>
  )
}
