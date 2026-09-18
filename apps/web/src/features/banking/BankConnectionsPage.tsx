import { Alert, Button, Paper, Stack, Text, Title } from '@mantine/core'
import { IconBuildingBank } from '@tabler/icons-react'

export function BankConnectionsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Bank connections</Title>
          <Text c="dimmed">Optional Open Banking synchronization architecture.</Text>
        </div>
      </div>
      <Paper withBorder p="xl" maw={760}>
        <Stack>
          <IconBuildingBank size={38} color="#145f52" />
          <Title order={3}>Manual entry is active</Title>
          <Text c="dimmed">
            Live Eurobank, Alpha Bank, and National Bank connectivity requires a regulated PSD2/Open
            Banking provider and production credentials. This app never asks for or stores
            online-banking passwords.
          </Text>
          <Alert color="teal">
            A mock provider is included for emulator development and idempotency testing. No live
            Greek bank connection is claimed or simulated.
          </Alert>
          <Button disabled>Connect a bank</Button>
        </Stack>
      </Paper>
    </div>
  )
}
