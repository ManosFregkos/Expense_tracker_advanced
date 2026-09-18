import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Anchor,
  Button,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { auth } from '../../lib/firebase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from './AuthProvider'

const schema = z.object({
  displayName: z.string().trim().max(100).optional(),
  email: z.email(),
  password: z.string().min(8).max(128),
})
type Values = z.infer<typeof schema>

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })
  if (user) return <Navigate to="/dashboard" replace />
  const finish = () => {
    void navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', {
      replace: true,
    })
  }

  const submit = handleSubmit(async (values) => {
    setError('')
    try {
      if (mode === 'register') {
        if (!values.displayName?.trim()) {
          setError('Enter your name.')
          return
        }
        const credential = await createUserWithEmailAndPassword(auth, values.email, values.password)
        await updateProfile(credential.user, { displayName: values.displayName.trim() })
        await sendEmailVerification(credential.user)
        notifications.show({
          color: 'teal',
          title: 'Account created',
          message: 'Check your inbox to verify your email.',
        })
      } else await signInWithEmailAndPassword(auth, values.email, values.password)
      finish()
    } catch (caught) {
      setError(friendlyError(caught))
    }
  })

  const google = async () => {
    setError('')
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      finish()
    } catch (caught) {
      setError(friendlyError(caught))
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div>
          <Text fw={800} size="xl">
            Family Finance
          </Text>
          <Title mt={70} order={1} size={48} maw={520}>
            A clear view of the money your household shares.
          </Title>
          <Text mt="lg" size="lg" c="teal.1" maw={520}>
            Private account ownership, shared family visibility, and useful spending trends.
          </Text>
        </div>
        <Text c="teal.2" size="sm">
          Built for households, not debt splitting.
        </Text>
      </section>
      <section className="auth-panel">
        <form onSubmit={(event) => void submit(event)} style={{ width: '100%' }}>
          <Stack gap="md">
            <div>
              <Title order={2}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Title>
              <Text c="dimmed" mt={6}>
                {mode === 'login'
                  ? 'Sign in to your household workspace.'
                  : 'Start with your household, then add accounts.'}
              </Text>
            </div>
            {error && <Alert color="red">{error}</Alert>}
            {mode === 'register' && (
              <TextInput
                label="Your name"
                autoComplete="name"
                error={errors.displayName?.message}
                {...register('displayName')}
              />
            )}
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <PasswordInput
              label="Password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" loading={isSubmitting} size="md">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <Divider label="or" labelPosition="center" />
            <Button variant="default" size="md" onClick={() => void google()}>
              Continue with Google
            </Button>
            <Group justify="center">
              <Text size="sm" c="dimmed">
                {mode === 'login' ? 'New here?' : 'Already registered?'}
              </Text>
              <Anchor component={Link} to={mode === 'login' ? '/register' : '/login'} size="sm">
                {mode === 'login' ? 'Create account' : 'Sign in'}
              </Anchor>
            </Group>
          </Stack>
        </form>
      </section>
    </main>
  )
}
