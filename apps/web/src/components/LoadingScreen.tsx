import { Center, Loader, Stack, Text } from '@mantine/core'

export function LoadingScreen({ label = 'Loading your household…' }: { label?: string }) {
  return (
    <Center mih="70vh">
      <Stack align="center">
        <Loader />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Stack>
    </Center>
  )
}
