import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Center,
  Group,
  Paper,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { householdKeys } from '../../lib/query-keys'
import { useAuth } from '../auth/AuthProvider'

const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  timeZone: z.string().min(1).max(100),
  displayName: z.string().trim().min(1).max(100),
})
type Values = z.infer<typeof onboardingSchema>
export function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [householdId, setHouseholdId] = useState('')
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: 'Fregkos Family',
      displayName: user?.displayName ?? '',
      defaultCurrency: 'EUR',
      timeZone:
        import.meta.env.VITE_DEFAULT_TIME_ZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  })
  const create = handleSubmit(async (values) => {
    try {
      const result = await api.createHousehold(values)
      setHouseholdId(result.householdId)
      localStorage.setItem('activeHouseholdId', result.householdId)
      setStep(1)
      void queryClient.invalidateQueries({ queryKey: householdKeys.all })
    } catch (caught) {
      setError(friendlyError(caught))
    }
  })
  const finish = () => {
    notifications.show({
      color: 'teal',
      title: 'Household ready',
      message: 'Add your accounts from the Accounts page.',
    })
    void navigate('/accounts', { replace: true })
  }
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" w="min(760px, 100%)">
        <Stack gap="xl">
          <div>
            <Text fw={800} c="teal.9">
              Family Finance
            </Text>
            <Title order={1} mt={8}>
              Set up your household
            </Title>
            <Text c="dimmed">A few details now; you can refine everything later.</Text>
          </div>
          <Stepper active={step} size="sm">
            <Stepper.Step label="Household" />
            <Stepper.Step label="Accounts" />
            <Stepper.Step label="Invite" />
          </Stepper>
          {error && <Alert color="red">{error}</Alert>}
          {step === 0 && (
            <form onSubmit={(event) => void create(event)}>
              <Stack>
                <TextInput
                  label="Household name"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <TextInput
                  label="Your display name"
                  error={errors.displayName?.message}
                  {...register('displayName')}
                />
                <Group grow>
                  <TextInput label="Currency" disabled {...register('defaultCurrency')} />
                  <TextInput label="Time zone" {...register('timeZone')} />
                </Group>
                <Button type="submit" loading={isSubmitting}>
                  Create household
                </Button>
              </Stack>
            </form>
          )}
          {step === 1 && (
            <Stack>
              <Title order={3}>Add your first accounts</Title>
              <Text c="dimmed">
                Accounts are individually owned. Cash is an account too. The Accounts page makes it
                quick to add each adult’s bank and cash accounts.
              </Text>
              <Button onClick={() => setStep(2)}>Continue</Button>
            </Stack>
          )}
          {step === 2 && (
            <Stack>
              <Title order={3}>Invite another adult</Title>
              <Text c="dimmed">
                You can invite a spouse or partner from Members after adding your accounts.
                Invitations use a secure server workflow.
              </Text>
              <Button onClick={finish}>Go to accounts</Button>
              <Text size="xs" c="dimmed">
                Household ID: {householdId}
              </Text>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Center>
  )
}
