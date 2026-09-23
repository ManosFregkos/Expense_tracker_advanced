import {
  Button,
  Card,
  Checkbox,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KidsSettings } from '@family-expense-tracker/shared'
import { api } from '../../../lib/callables'
import { kidsKeys } from '../../../lib/query-keys'
import { useHousehold } from '../../households/HouseholdProvider'
import { useKidsProfiles, useKidsSettings } from '../hooks'

export function KidsParentSettingsPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { household } = useHousehold()
  const profiles = useKidsProfiles()
  const [profileId, setProfileId] = useState('')
  const [name, setName] = useState('')
  const settings = useKidsSettings(profileId)
  const [form, setForm] = useState<Omit<KidsSettings, 'childProfileId' | 'updatedAt'>>({
    narrationEnabled: true,
    soundEffectsEnabled: true,
    animationsEnabled: true,
    sessionLength: 5,
    difficultyMode: 'AUTO',
    currentDifficulty: 1,
  })
  useEffect(() => {
    if (!profileId && profiles.data?.[0]) setProfileId(profiles.data[0].id)
  }, [profileId, profiles.data])
  useEffect(() => {
    if (!settings.data) return
    const { childProfileId: _childProfileId, updatedAt: _updatedAt, ...value } = settings.data
    setForm(value)
  }, [settings.data])
  const create = useMutation({
    mutationFn: () =>
      api.createKidsChildProfile({ householdId: household!.id, displayName: name, avatar: '🌟' }),
    onSuccess: async ({ childProfileId }) => {
      setName('')
      setProfileId(childProfileId)
      localStorage.setItem('activeKidsProfileId', childProfileId)
      await client.invalidateQueries({ queryKey: kidsKeys.profiles(household!.id) })
      notifications.show({ color: 'teal', message: 'Το παιδικό προφίλ δημιουργήθηκε.' })
    },
    onError: () =>
      notifications.show({ color: 'red', message: 'Δεν ήταν δυνατή η δημιουργία προφίλ.' }),
  })
  const save = useMutation({
    mutationFn: () =>
      api.updateKidsSettings({
        householdId: household!.id,
        childProfileId: profileId,
        narrationEnabled: form.narrationEnabled,
        soundEffectsEnabled: form.soundEffectsEnabled,
        animationsEnabled: form.animationsEnabled,
        sessionLength: form.sessionLength,
        difficultyMode: form.difficultyMode,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: kidsKeys.settings(household!.id, profileId) })
      notifications.show({ color: 'teal', message: 'Οι ρυθμίσεις Kids αποθηκεύτηκαν.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Οι ρυθμίσεις δεν αποθηκεύτηκαν.' }),
  })
  const submitProfile = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) create.mutate()
  }
  return (
    <div className="page">
      <Group justify="space-between" className="page-header">
        <div>
          <Title order={1}>Kids learning</Title>
          <Text c="dimmed">Parent controls for calm card-learning sessions.</Text>
        </div>
        <Button onClick={() => void navigate('/kids')}>Open Kids mode</Button>
      </Group>
      <Stack maw={720}>
        <Card withBorder padding="lg">
          <Title order={3} mb="md">
            Child profiles
          </Title>
          {profiles.data?.length ? (
            <NativeSelect
              label="Active profile"
              value={profileId}
              onChange={(event) => setProfileId(event.currentTarget.value)}
              data={profiles.data.map((profile) => ({
                value: profile.id,
                label: profile.displayName,
              }))}
            />
          ) : (
            <Text c="dimmed" mb="md">
              No child profile yet.
            </Text>
          )}
          <form onSubmit={submitProfile}>
            <Group align="end" mt="md">
              <TextInput
                label="New profile name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                maxLength={40}
              />
              <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
                Create profile
              </Button>
            </Group>
          </form>
        </Card>
        {profileId ? (
          <Card withBorder padding="lg">
            <Title order={3} mb="md">
              Session settings
            </Title>
            <Stack>
              <Checkbox
                label="Narration"
                checked={form.narrationEnabled}
                onChange={(event) =>
                  setForm((value) => ({ ...value, narrationEnabled: event.currentTarget.checked }))
                }
              />
              <Checkbox
                label="Sound effects"
                checked={form.soundEffectsEnabled}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    soundEffectsEnabled: event.currentTarget.checked,
                  }))
                }
              />
              <Checkbox
                label="Animations"
                checked={form.animationsEnabled}
                onChange={(event) =>
                  setForm((value) => ({ ...value, animationsEnabled: event.currentTarget.checked }))
                }
              />
              <NativeSelect
                label="Session length"
                value={String(form.sessionLength)}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    sessionLength: Number(event.currentTarget.value) as 5 | 10 | 15,
                  }))
                }
                data={[
                  { value: '5', label: '5 rounds' },
                  { value: '10', label: '10 rounds' },
                  { value: '15', label: '15 rounds' },
                ]}
              />
              <NativeSelect
                label="Difficulty"
                value={form.difficultyMode}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    difficultyMode: event.currentTarget.value as KidsSettings['difficultyMode'],
                  }))
                }
                data={[
                  { value: 'AUTO', label: 'Auto (gentle)' },
                  { value: 'EASY', label: 'Easy' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HARD', label: 'Hard' },
                ]}
              />
              <Button onClick={() => save.mutate()} loading={save.isPending}>
                Save settings
              </Button>
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </div>
  )
}
