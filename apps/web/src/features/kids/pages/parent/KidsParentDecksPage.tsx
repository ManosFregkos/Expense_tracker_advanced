import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useHousehold } from '../../../households/HouseholdProvider'
import { KidsContentRepository, getDeckCapabilities } from '../../content/KidsContentRepository'
import { modeLabels } from '../../i18n'

export function KidsParentDecksPage() {
  const navigate = useNavigate()
  const { household } = useHousehold()
  const content = useQuery({
    queryKey: ['kids', household?.id, 'parent-content'],
    enabled: Boolean(household),
    queryFn: async () => {
      const repository = new KidsContentRepository(household!.id)
      const [decks, cards, relationships] = await Promise.all([
        repository.getDecks(),
        repository.getCards(),
        repository.getRelationships(),
      ])
      return { decks, cards, relationships }
    },
  })
  return (
    <div className="page">
      <Group justify="space-between" className="page-header">
        <div>
          <Title order={1}>Τράπουλες Kids</Title>
          <Text c="dimmed">Οι τράπουλες συστήματος είναι μόνο για ανάγνωση.</Text>
        </div>
        <Button onClick={() => void navigate('/kids/parent/decks/new')}>+ Νέα τράπουλα</Button>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {content.data?.decks.map((deck) => {
          const deckCards = content.data.cards.filter((card) => deck.cardIds.includes(card.id))
          const capabilities = getDeckCapabilities(
            deck,
            content.data.cards,
            content.data.relationships,
          )
          const supported = [
            capabilities.learnAndChoose && 'LEARN_AND_CHOOSE',
            capabilities.memoryPairs && 'MEMORY_PAIRS',
            capabilities.matching && 'MATCHING',
            capabilities.oddOneOut && 'ODD_ONE_OUT',
            capabilities.compare && 'COMPARE',
            capabilities.classify && 'CLASSIFY',
          ].filter(Boolean) as Array<keyof typeof modeLabels>
          return (
            <Card withBorder padding="lg" key={deck.id}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Title order={3}>
                    {deck.icon ?? '🎴'} {deck.title}
                  </Title>
                  <Badge color={deck.origin === 'SYSTEM' ? 'blue' : deck.enabled ? 'teal' : 'gray'}>
                    {deck.origin === 'SYSTEM' ? 'Σύστημα' : deck.enabled ? 'Ενεργή' : 'Ανενεργή'}
                  </Badge>
                </Group>
                <Text c="dimmed">{deck.description || 'Χωρίς περιγραφή'}</Text>
                <Text size="sm">
                  {deckCards.length} κάρτες ·{' '}
                  {supported.map((mode) => modeLabels[mode]).join(', ') || 'Χρειάζεται περιεχόμενο'}
                </Text>
                <Button
                  variant="light"
                  onClick={() => void navigate('/kids/parent/decks/' + deck.id)}
                >
                  {deck.origin === 'SYSTEM' ? 'Προβολή' : 'Επεξεργασία'}
                </Button>
              </Stack>
            </Card>
          )
        })}
      </SimpleGrid>
    </div>
  )
}
