import {
  Badge,
  Card,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { listKidsSessions } from '../../../../lib/repositories'
import { useHousehold } from '../../../households/HouseholdProvider'
import { useKidsProfiles, useKidsProgress, useKidsSettings } from '../../hooks'
import { modeLabels } from '../../i18n'

export function KidsParentProgressPage() {
  const { household } = useHousehold()
  const profiles = useKidsProfiles()
  const [profileId, setProfileId] = useState('')
  useEffect(() => {
    if (!profileId && profiles.data?.[0]) setProfileId(profiles.data[0].id)
  }, [profileId, profiles.data])
  const progress = useKidsProgress(profileId || undefined)
  const settings = useKidsSettings(profileId || undefined)
  const sessions = useQuery({
    queryKey: ['kids', household?.id, profileId, 'sessions'],
    enabled: Boolean(household && profileId),
    queryFn: () => listKidsSessions(household!.id, profileId),
  })
  const items = progress.data ?? []
  const counts = {
    seen: items.length,
    fresh: items.filter((item) => item.status === 'NEW').length,
    learning: items.filter((item) => item.status === 'LEARNING').length,
    familiar: items.filter((item) => item.status === 'FAMILIAR').length,
    repetition: items.filter((item) => (item.recentMisses ?? 0) > 0).length,
  }
  return (
    <div className="page">
      <Group justify="space-between" className="page-header">
        <div>
          <Title order={1}>Πρόοδος Kids</Title>
          <Text c="dimmed">
            Περιγραφική εικόνα του περιεχομένου που χρησιμοποιείται — όχι αξιολόγηση ανάπτυξης.
          </Text>
        </div>
        <NativeSelect
          label="Παιδικό προφίλ"
          data={
            profiles.data?.map((profile) => ({ value: profile.id, label: profile.displayName })) ??
            []
          }
          value={profileId}
          onChange={(event) => setProfileId(event.currentTarget.value)}
        />
      </Group>
      <SimpleGrid cols={{ base: 2, md: 5 }} mb="lg">
        {[
          ['Κάρτες που εμφανίστηκαν', counts.seen],
          ['Νέες κάρτες', counts.fresh],
          ['Μαθαίνονται τώρα', counts.learning],
          ['Τα αναγνωρίζει συχνά', counts.familiar],
          ['Χρειάζονται περισσότερη εξάσκηση', counts.repetition],
        ].map(([label, value]) => (
          <Card withBorder key={label}>
            <Text size="sm" c="dimmed">
              {label}
            </Text>
            <Title order={2}>{value}</Title>
          </Card>
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder padding="lg">
          <Title order={3} mb="md">
            Τρέχουσα αυτόματη δυσκολία ανά παιχνίδι
          </Title>
          <Stack gap="xs">
            {Object.entries(settings.data?.modeDifficulties ?? {}).map(([mode, level]) => (
              <Group justify="space-between" key={mode}>
                <Text>{modeLabels[mode as keyof typeof modeLabels]}</Text>
                <Badge color="teal">
                  {settings.data?.difficultyMode === 'AUTO' ? 'Αυτόματη · ' : 'Σταθερή · '}
                  {level}
                </Badge>
              </Group>
            ))}
            {!Object.keys(settings.data?.modeDifficulties ?? {}).length ? (
              <Text c="dimmed">Θα εμφανιστεί μετά από λίγους γύρους.</Text>
            ) : null}
          </Stack>
        </Card>
        <Card withBorder padding="lg">
          <Title order={3} mb="md">
            Πρόσφατες συνεδρίες
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Παιχνίδι</Table.Th>
                <Table.Th>Γύροι</Table.Th>
                <Table.Th>Κατάσταση</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sessions.data?.slice(0, 8).map((session) => (
                <Table.Tr key={session.id}>
                  <Table.Td>{modeLabels[session.mode]}</Table.Td>
                  <Table.Td>
                    {session.completedRounds}/{session.plannedRounds}
                  </Table.Td>
                  <Table.Td>
                    {session.status === 'COMPLETED' ? 'Ολοκληρώθηκε' : 'Σε εξέλιξη'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      </SimpleGrid>
    </div>
  )
}
