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
    earlyMath: {
      numberRange: 'ONE_TO_FIVE',
      addition: 'WITHIN_THREE',
      showNumerals: 'AUTO',
      fingersEnabled: true,
      countObjectsEnabled: true,
    },
    flags: { enabled: true, tier: 'AUTO', newPerSession: 3 },
    contentAreas: { patterns: true, spatial: true, weather: true, professions: true },
  })
  useEffect(() => {
    if (!profileId && profiles.data?.[0]) setProfileId(profiles.data[0].id)
  }, [profileId, profiles.data])
  useEffect(() => {
    if (!settings.data) return
    const { childProfileId: _childProfileId, updatedAt: _updatedAt, ...value } = settings.data
    setForm((current) => ({
      ...current,
      ...value,
      earlyMath: value.earlyMath ?? current.earlyMath,
      flags: value.flags ?? current.flags,
      contentAreas: value.contentAreas ?? current.contentAreas,
    }))
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
        earlyMath: form.earlyMath,
        flags: form.flags,
        contentAreas: form.contentAreas,
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
          <>
            <Card withBorder padding="lg">
              <Title order={3} mb="md">
                Session settings
              </Title>
              <Stack>
                <Checkbox
                  label="Narration"
                  checked={form.narrationEnabled}
                  onChange={(event) => {
                    const narrationEnabled = event.currentTarget.checked
                    setForm((value) => ({ ...value, narrationEnabled }))
                  }}
                />
                <Checkbox
                  label="Sound effects"
                  checked={form.soundEffectsEnabled}
                  onChange={(event) => {
                    const soundEffectsEnabled = event.currentTarget.checked
                    setForm((value) => ({
                      ...value,
                      soundEffectsEnabled,
                    }))
                  }}
                />
                <Checkbox
                  label="Animations"
                  checked={form.animationsEnabled}
                  onChange={(event) => {
                    const animationsEnabled = event.currentTarget.checked
                    setForm((value) => ({ ...value, animationsEnabled }))
                  }}
                />
                <NativeSelect
                  label="Session length"
                  value={String(form.sessionLength)}
                  onChange={(event) => {
                    const sessionLength = Number(event.currentTarget.value) as 5 | 10 | 15
                    setForm((value) => ({
                      ...value,
                      sessionLength,
                    }))
                  }}
                  data={[
                    { value: '5', label: '5 rounds' },
                    { value: '10', label: '10 rounds' },
                    { value: '15', label: '15 rounds' },
                  ]}
                />
                <NativeSelect
                  label="Difficulty"
                  value={form.difficultyMode}
                  onChange={(event) => {
                    const difficultyMode = event.currentTarget
                      .value as KidsSettings['difficultyMode']
                    setForm((value) => ({
                      ...value,
                      difficultyMode,
                    }))
                  }}
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
            <Card withBorder padding="lg">
              <Title order={3} mb="md">
                Νέες δραστηριότητες
              </Title>
              <Stack>
                {([
                  ['patterns', 'Μοτίβα'],
                  ['spatial', 'Χωρικές έννοιες'],
                  ['weather', 'Καιρός'],
                  ['professions', 'Επαγγέλματα'],
                ] as const).map(([key, label]) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={form.contentAreas?.[key] ?? true}
                    onChange={(event) => {
                      const enabled = event.currentTarget.checked
                      setForm((value) => ({
                        ...value,
                        contentAreas: {
                          ...(value.contentAreas ?? {
                            patterns: true,
                            spatial: true,
                            weather: true,
                            professions: true,
                          }),
                          [key]: enabled,
                        },
                      }))
                    }}
                  />
                ))}
                <Button onClick={() => save.mutate()} loading={save.isPending}>
                  Αποθήκευση
                </Button>
              </Stack>
            </Card>
            <Card withBorder padding="lg">
              <Title order={3} mb="md">
                Αριθμοί
              </Title>
              <Stack>
                <NativeSelect
                  label="Εύρος μέτρησης"
                  value={form.earlyMath?.numberRange ?? 'ONE_TO_FIVE'}
                  onChange={(event) => {
                    const numberRange = event.currentTarget.value as 'ONE_TO_THREE' | 'ONE_TO_FIVE'
                    setForm((value) => ({
                      ...value,
                      earlyMath: {
                        ...(value.earlyMath ?? {
                          addition: 'WITHIN_THREE',
                          showNumerals: 'AUTO',
                          fingersEnabled: true,
                          countObjectsEnabled: true,
                        }),
                        numberRange,
                      },
                    }))
                  }}
                  data={[
                    { value: 'ONE_TO_THREE', label: '1-3' },
                    { value: 'ONE_TO_FIVE', label: '1-5' },
                  ]}
                />
                <NativeSelect
                  label="Απλές προσθέσεις"
                  value={form.earlyMath?.addition ?? 'WITHIN_THREE'}
                  onChange={(event) => {
                    const addition = event.currentTarget.value as
                      'OFF' | 'WITHIN_THREE' | 'WITHIN_FIVE'
                    setForm((value) => ({
                      ...value,
                      earlyMath: {
                        ...(value.earlyMath ?? {
                          numberRange: 'ONE_TO_FIVE',
                          showNumerals: 'AUTO',
                          fingersEnabled: true,
                          countObjectsEnabled: true,
                        }),
                        addition,
                      },
                    }))
                  }}
                  data={[
                    { value: 'OFF', label: 'Κλειστές' },
                    { value: 'WITHIN_THREE', label: 'Μέχρι το 3' },
                    { value: 'WITHIN_FIVE', label: 'Μέχρι το 5' },
                  ]}
                />
                <NativeSelect
                  label="Αριθμοί μαζί με ποσότητες"
                  value={form.earlyMath?.showNumerals ?? 'AUTO'}
                  onChange={(event) => {
                    const showNumerals = event.currentTarget.value as 'ON' | 'OFF' | 'AUTO'
                    setForm((value) => ({
                      ...value,
                      earlyMath: {
                        ...(value.earlyMath ?? {
                          numberRange: 'ONE_TO_FIVE',
                          addition: 'WITHIN_THREE',
                          fingersEnabled: true,
                          countObjectsEnabled: true,
                        }),
                        showNumerals,
                      },
                    }))
                  }}
                  data={[
                    { value: 'AUTO', label: 'Αυτόματα' },
                    { value: 'ON', label: 'Ναι' },
                    { value: 'OFF', label: 'Όχι' },
                  ]}
                />
                <Checkbox
                  label="Δάχτυλα"
                  checked={form.earlyMath?.fingersEnabled ?? true}
                  onChange={(event) => {
                    const fingersEnabled = event.currentTarget.checked
                    setForm((value) => ({
                      ...value,
                      earlyMath: {
                        ...(value.earlyMath ?? {
                          numberRange: 'ONE_TO_FIVE',
                          addition: 'WITHIN_THREE',
                          showNumerals: 'AUTO',
                          countObjectsEnabled: true,
                        }),
                        fingersEnabled,
                      },
                    }))
                  }}
                />
                <Checkbox
                  label="Μέτρηση αντικειμένων"
                  checked={form.earlyMath?.countObjectsEnabled ?? true}
                  onChange={(event) => {
                    const countObjectsEnabled = event.currentTarget.checked
                    setForm((value) => ({
                      ...value,
                      earlyMath: {
                        ...(value.earlyMath ?? {
                          numberRange: 'ONE_TO_FIVE',
                          addition: 'WITHIN_THREE',
                          showNumerals: 'AUTO',
                          fingersEnabled: true,
                        }),
                        countObjectsEnabled,
                      },
                    }))
                  }}
                />
              </Stack>
            </Card>
            <Card withBorder padding="lg">
              <Title order={3} mb="md">
                Σημαίες
              </Title>
              <Stack>
                <Checkbox
                  label="Ενεργές σημαίες"
                  checked={form.flags?.enabled ?? true}
                  onChange={(event) => {
                    const enabled = event.currentTarget.checked
                    setForm((value) => ({
                      ...value,
                      flags: { ...(value.flags ?? { tier: 'AUTO', newPerSession: 3 }), enabled },
                    }))
                  }}
                />
                <NativeSelect
                  label="Ομάδα σημαιών"
                  value={form.flags?.tier ?? 'AUTO'}
                  onChange={(event) => {
                    const tier = event.currentTarget.value as 'AUTO' | 'STARTER' | 'EXPANDED'
                    setForm((value) => ({
                      ...value,
                      flags: { ...(value.flags ?? { enabled: true, newPerSession: 3 }), tier },
                    }))
                  }}
                  data={[
                    { value: 'AUTO', label: 'Αυτόματα' },
                    { value: 'STARTER', label: 'Αρχικές' },
                    { value: 'EXPANDED', label: 'Περισσότερες' },
                  ]}
                />
                <NativeSelect
                  label="Νέες σημαίες ανά μάθημα"
                  value={String(form.flags?.newPerSession ?? 3)}
                  onChange={(event) => {
                    const newPerSession = Number(event.currentTarget.value) as 2 | 3 | 4
                    setForm((value) => ({
                      ...value,
                      flags: { ...(value.flags ?? { enabled: true, tier: 'AUTO' }), newPerSession },
                    }))
                  }}
                  data={['2', '3', '4']}
                />
                <Button onClick={() => save.mutate()} loading={save.isPending}>
                  Αποθήκευση
                </Button>
              </Stack>
            </Card>
          </>
        ) : null}
      </Stack>
    </div>
  )
}
