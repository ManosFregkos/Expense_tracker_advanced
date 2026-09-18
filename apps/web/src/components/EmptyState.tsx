import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { IconReceiptOff } from '@tabler/icons-react'

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string
  message: string
  actionLabel?: string
  onAction?(): void
}) {
  return (
    <Center py={64}>
      <Stack align="center" maw={420} ta="center">
        <IconReceiptOff size={38} color="#83928f" />
        <Title order={3}>{title}</Title>
        <Text c="dimmed">{message}</Text>
        {actionLabel && onAction && (
          <Button variant="light" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Center>
  )
}
