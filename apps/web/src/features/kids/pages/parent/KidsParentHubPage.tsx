import { Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router-dom'

export function KidsParentHubPage() {
  const navigate = useNavigate()
  const items = [
    {
      title: 'Άμεσο παιχνίδι',
      text: 'Επιλογή προφίλ, παιχνιδιού, τράπουλας και δυσκολίας.',
      path: '/kids/parent/play',
    },
    {
      title: 'Τράπουλες και κάρτες',
      text: 'Δημιουργία, εικόνες, σχέσεις και συμβατότητα.',
      path: '/kids/parent/decks',
    },
    {
      title: 'Σενάρια',
      text: 'Καθημερινές επιλογές, ακολουθίες και συναισθήματα.',
      path: '/kids/parent/scenarios',
    },
    {
      title: 'Πρόοδος',
      text: 'Περιγραφική εικόνα χρήσης, χωρίς αξιολογικές ετικέτες.',
      path: '/kids/parent/progress',
    },
    {
      title: 'Ρυθμίσεις',
      text: 'Προφίλ, αφήγηση, διάρκεια και δυσκολία.',
      path: '/kids/parent/settings',
    },
  ]
  return (
    <div className="page">
      <Group justify="space-between" className="page-header">
        <div>
          <Title order={1}>Kids — Γονέας</Title>
          <Text c="dimmed">Περιεχόμενο και ήρεμες ρυθμίσεις παιχνιδιού.</Text>
        </div>
        <Button onClick={() => void navigate('/kids')}>Άνοιγμα Kids</Button>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {items.map((item) => (
          <Card key={item.path} withBorder padding="lg">
            <Stack>
              <Title order={3}>{item.title}</Title>
              <Text c="dimmed">{item.text}</Text>
              <Button variant="light" onClick={() => void navigate(item.path)}>
                Άνοιγμα
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </div>
  )
}
