import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false }
  static getDerivedStateFromError(): State {
    return { failed: true }
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error', error, info.componentStack)
  }
  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <Center mih="100vh" p="xl">
        <Stack align="center">
          <Title order={2}>Something went wrong</Title>
          <Text c="dimmed">Your data is safe. Reload the application to try again.</Text>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Stack>
      </Center>
    )
  }
}
