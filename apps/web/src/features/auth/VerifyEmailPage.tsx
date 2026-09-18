import { Alert, Button, Center, Paper, Stack, Text, Title } from '@mantine/core'
import { sendEmailVerification, signOut } from 'firebase/auth'
import { useState } from 'react'
import { auth } from '../../lib/firebase'
import { friendlyError } from '../../lib/errors'

export function VerifyEmailPage() {
  const [message, setMessage] = useState('')
  const refresh = async () => {
    await auth.currentUser?.reload()
    await auth.currentUser?.getIdToken(true)
    window.location.reload()
  }
  const resend = async () => {
    try {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser)
      setMessage('Verification email sent.')
    } catch (error) {
      setMessage(friendlyError(error))
    }
  }
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" maw={480}>
        <Stack>
          <Title order={2}>Verify your email</Title>
          <Text c="dimmed">
            Open the verification link sent to <strong>{auth.currentUser?.email}</strong>. Financial
            changes remain locked until the address is verified.
          </Text>
          {message && <Alert>{message}</Alert>}
          <Button onClick={() => void refresh()}>I have verified my email</Button>
          <Button variant="light" onClick={() => void resend()}>
            Resend email
          </Button>
          <Button variant="subtle" color="gray" onClick={() => void signOut(auth)}>
            Sign out
          </Button>
        </Stack>
      </Paper>
    </Center>
  )
}
