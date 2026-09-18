import { zodResolver } from '@hookform/resolvers/zod'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../households/HouseholdProvider'
import { useMembers } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { householdKeys, invitationKeys } from '../../lib/query-keys'
import { listHouseholdInvitations, listMyInvitations } from '../../lib/repositories'

const schema = z.object({ email: z.email(), role: z.enum(['ADMIN', 'MEMBER']) })
type Values = z.infer<typeof schema>
export function MembersPage() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const members = useMembers()
  const [opened, modal] = useDisclosure(false)
  const queryClient = useQueryClient()
  const invitations = useQuery({
    queryKey: ['household-invitations', household?.id],
    queryFn: () => listHouseholdInvitations(household!.id),
    enabled: Boolean(household),
  })
  const mine = useQuery({
    queryKey: invitationKeys.mine(user?.email ?? ''),
    queryFn: () => listMyInvitations(user!.email!),
    enabled: Boolean(user?.email),
  })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { role: 'MEMBER' } })
  const invite = useMutation({
    mutationFn: (values: Values) =>
      api.createInvitation({ householdId: household!.id, email: values.email, role: values.role }),
    onSuccess: async () => {
      await invitations.refetch()
      notifications.show({ color: 'teal', message: 'Invitation created.' })
      reset()
      modal.close()
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const accept = useMutation({
    mutationFn: (id: string) => api.acceptInvitation({ invitationId: id }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: householdKeys.all }),
        mine.refetch(),
      ])
      notifications.show({ color: 'teal', message: 'Invitation accepted.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Members</Title>
          <Text c="dimmed">All V1 members can view and manage household financial data.</Text>
        </div>
        <Button onClick={modal.open}>Invite member</Button>
      </div>
      {!!mine.data?.length && (
        <Stack mb="xl">
          {mine.data.map((invitation) => (
            <Card withBorder key={invitation.id}>
              <Group justify="space-between">
                <div>
                  <Text fw={700}>Invitation to {invitation.householdName}</Text>
                  <Text size="sm" c="dimmed">
                    Role: {invitation.role}
                  </Text>
                </div>
                <Button loading={accept.isPending} onClick={() => accept.mutate(invitation.id)}>
                  Accept
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {(members.data ?? []).map((member) => (
          <Card withBorder key={member.userId}>
            <Group>
              <Avatar color="teal">{member.displayName[0]}</Avatar>
              <div>
                <Text fw={700}>{member.displayName}</Text>
                <Badge variant="light">{member.role}</Badge>
              </div>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
      {!!invitations.data?.length && (
        <section>
          <Title order={3} mt="xl" mb="sm">
            Pending invitations
          </Title>
          <Stack>
            {invitations.data.map((invitation) => (
              <Card withBorder key={invitation.id}>
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{invitation.email}</Text>
                    <Text size="xs" c="dimmed">
                      {invitation.role}
                    </Text>
                  </div>
                  <Badge color="yellow">{invitation.status}</Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        </section>
      )}
      <Modal opened={opened} onClose={modal.close} title="Invite household member">
        <form onSubmit={(event) => void handleSubmit((values) => invite.mutate(values))(event)}>
          <Stack>
            <TextInput
              label="Email"
              type="email"
              autoFocus
              error={errors.email?.message}
              {...register('email')}
            />
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select
                  label="Role"
                  data={[
                    { value: 'MEMBER', label: 'Member' },
                    { value: 'ADMIN', label: 'Administrator' },
                  ]}
                  {...field}
                />
              )}
            />
            <Text size="xs" c="dimmed">
              The recipient must sign in with this verified email to accept.
            </Text>
            <Button type="submit" loading={invite.isPending}>
              Create invitation
            </Button>
          </Stack>
        </form>
      </Modal>
    </div>
  )
}
