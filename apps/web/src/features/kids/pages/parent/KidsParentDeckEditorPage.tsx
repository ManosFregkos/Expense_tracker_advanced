import {
  Badge,
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type {
  KidsCardGameMode,
  KidsRelationshipType,
  LearningCard,
  LearningDeck,
} from '@family-expense-tracker/shared'
import { api } from '../../../../lib/callables'
import { useHousehold } from '../../../households/HouseholdProvider'
import { KidsContentRepository, getDeckCapabilities } from '../../content/KidsContentRepository'
import { KIDS_ASSETS } from '../../content/system'
import { modeLabels } from '../../i18n'
import { uploadKidsCardImage } from '../../services/kidsImageUpload'

const allModes: KidsCardGameMode[] = [
  'LEARN_AND_CHOOSE',
  'SAME_OR_DIFFERENT',
  'MATCHING',
  'ODD_ONE_OUT',
  'COMPARE',
  'CLASSIFY',
  'MEMORY_PAIRS',
]
const relationshipTypes: KidsRelationshipType[] = [
  'MATCHES',
  'USED_WITH',
  'LIVES_IN',
  'BELONGS_IN',
  'STORED_IN',
  'USED_IN',
  'PRODUCES',
  'WEARS',
  'WORN_ON',
  'PART_OF',
]

function newId(prefix: string) {
  return prefix + '-' + crypto.randomUUID().replaceAll('-', '')
}

export function KidsParentDeckEditorPage() {
  const { deckId: routeDeckId } = useParams()
  const generatedId = useRef(newId('deck'))
  const deckId = routeDeckId === 'new' || !routeDeckId ? generatedId.current : routeDeckId
  const { household } = useHousehold()
  const navigate = useNavigate()
  const client = useQueryClient()
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
  const existing = content.data?.decks.find((deck) => deck.id === deckId)
  const [deck, setDeck] = useState<LearningDeck>({
    id: deckId,
    title: '',
    description: '',
    category: 'CUSTOM',
    supportedModes: allModes,
    cardIds: [],
    enabled: false,
    origin: 'CUSTOM',
    icon: '🎴',
  })
  const [card, setCard] = useState({
    title: '',
    narration: '',
    category: 'CUSTOM',
    tags: [] as string[],
    assetId: '',
    alternativeNarration: '',
    enabled: true,
    color: '',
    size: '',
    location: '',
    count: '',
  })
  const [image, setImage] = useState<File | null>(null)
  const [editingCardId, setEditingCardId] = useState<string>()
  const [relationship, setRelationship] = useState({
    sourceCardId: '',
    targetCardId: '',
    type: 'MATCHES' as KidsRelationshipType,
  })

  useEffect(() => {
    if (existing) setDeck(existing)
  }, [existing])

  const customCards = useMemo(
    () =>
      deck.cardIds.flatMap((id) => {
        const item = content.data?.cards.find((card) => card.id === id)
        return item ? [item] : []
      }),
    [content.data?.cards, deck.cardIds],
  )
  const capabilities = content.data
    ? getDeckCapabilities(deck, content.data.cards, content.data.relationships)
    : null
  const invalidate = () =>
    client.invalidateQueries({ queryKey: ['kids', household?.id, 'parent-content'] })

  const saveDeck = useMutation({
    mutationFn: (value: LearningDeck) =>
      api.saveKidsCustomContent({
        householdId: household!.id,
        kind: 'DECK',
        content: { ...value },
      }),
    onSuccess: async () => {
      await invalidate()
      notifications.show({ color: 'teal', message: 'Η τράπουλα αποθηκεύτηκε.' })
      if (routeDeckId === 'new') void navigate('/kids/parent/decks/' + deckId, { replace: true })
    },
    onError: () => notifications.show({ color: 'red', message: 'Η τράπουλα δεν αποθηκεύτηκε.' }),
  })

  const addCard = useMutation({
    mutationFn: async () => {
      const cardId = editingCardId ?? newId('card')
      const existingCard = customCards.find((item) => item.id === cardId)
      let assetId = card.assetId
      let assetUrl: string | undefined = existingCard?.assetUrl
      if (image) {
        const upload = await uploadKidsCardImage(household!.id, 'asset-' + cardId, image)
        assetId = upload.assetId
        assetUrl = upload.downloadUrl
      }
      if (!assetId) throw new Error('Επιλέξτε ή ανεβάστε εικόνα.')
      const value: LearningCard = {
        id: cardId,
        deckId,
        title: card.title.trim(),
        narration: card.narration.trim(),
        assetId,
        category: card.category.trim(),
        tags: card.tags,
        attributes: {
          ...(card.color ? { color: card.color } : {}),
          ...(card.size ? { size: card.size } : {}),
          ...(card.location ? { location: card.location } : {}),
          ...(card.count ? { count: Number(card.count) } : {}),
        },
        difficulty: 1,
        enabled: card.enabled,
        origin: 'CUSTOM',
        ...(card.alternativeNarration ? { alternativeNarration: card.alternativeNarration } : {}),
        ...(assetUrl ? { assetUrl } : {}),
      }
      await api.saveKidsCustomContent({
        householdId: household!.id,
        kind: 'CARD',
        content: { ...value },
      })
      const nextDeck = {
        ...deck,
        cardIds: deck.cardIds.includes(cardId) ? deck.cardIds : [...deck.cardIds, cardId],
      }
      await api.saveKidsCustomContent({
        householdId: household!.id,
        kind: 'DECK',
        content: { ...nextDeck },
      })
      setDeck(nextDeck)
    },
    onSuccess: async () => {
      setCard({
        title: '',
        narration: '',
        category: 'CUSTOM',
        tags: [],
        assetId: '',
        alternativeNarration: '',
        enabled: true,
        color: '',
        size: '',
        location: '',
        count: '',
      })
      setImage(null)
      setEditingCardId(undefined)
      await invalidate()
      notifications.show({ color: 'teal', message: 'Η κάρτα προστέθηκε.' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Η κάρτα δεν αποθηκεύτηκε.',
      }),
  })

  const saveRelationship = useMutation({
    mutationFn: () =>
      api.saveKidsCustomContent({
        householdId: household!.id,
        kind: 'RELATIONSHIP',
        content: {
          id: newId('relationship'),
          sourceCardId: relationship.sourceCardId,
          targetCardId: relationship.targetCardId,
          type: relationship.type,
          narration: 'Η σχέση ορίστηκε από τον γονέα.',
          enabled: true,
          origin: 'CUSTOM',
        },
      }),
    onSuccess: async () => {
      await invalidate()
      notifications.show({ color: 'teal', message: 'Η σχέση αποθηκεύτηκε.' })
    },
  })

  const archive = useMutation({
    mutationFn: () =>
      api.archiveKidsCustomContent({
        householdId: household!.id,
        kind: 'DECK',
        contentId: deckId,
      }),
    onSuccess: () => void navigate('/kids/parent/decks'),
  })
  const archiveCard = useMutation({
    mutationFn: (contentId: string) =>
      api.archiveKidsCustomContent({
        householdId: household!.id,
        kind: 'CARD',
        contentId,
      }),
    onSuccess: invalidate,
  })
  const archiveRelationship = useMutation({
    mutationFn: (contentId: string) =>
      api.archiveKidsCustomContent({
        householdId: household!.id,
        kind: 'RELATIONSHIP',
        contentId,
      }),
    onSuccess: invalidate,
  })

  if (content.isLoading) return <div className="page">Φόρτωση…</div>
  if (existing?.origin === 'SYSTEM')
    return (
      <div className="page">
        <Title order={1}>{existing.title}</Title>
        <Text c="dimmed" mb="lg">
          Περιεχόμενο συστήματος — μόνο για προβολή.
        </Text>
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          {customCards.map((item) => (
            <Card key={item.id} withBorder>
              <Text fw={700}>{item.title}</Text>
              <Text>{item.narration}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </div>
    )

  const assetOptions = [...KIDS_ASSETS.entries()].slice(0, 150).map(([value, item]) => ({
    value,
    label: (item.symbol || '🖼️') + ' ' + (item.label || value),
  }))
  const cardOptions = customCards.map((item) => ({ value: item.id, label: item.title }))

  return (
    <div className="page">
      <Group justify="space-between" className="page-header">
        <div>
          <Title order={1}>{existing ? 'Επεξεργασία τράπουλας' : 'Νέα τράπουλα'}</Title>
          <Text c="dimmed">Οι αλλαγές έχουν σταθερά IDs και αρχειοθετούνται χωρίς διαγραφή.</Text>
        </div>
        <Group>
          {existing ? (
            <Button color="red" variant="light" onClick={() => archive.mutate()}>
              Αρχειοθέτηση
            </Button>
          ) : null}
          <Button
            onClick={() => saveDeck.mutate(deck)}
            disabled={!deck.title.trim()}
            loading={saveDeck.isPending}
          >
            Αποθήκευση
          </Button>
        </Group>
      </Group>

      <Stack>
        <Card withBorder padding="lg">
          <Stack>
            <Group grow>
              <TextInput
                label="Όνομα"
                value={deck.title}
                maxLength={80}
                onChange={(event) =>
                  setDeck((value) => ({ ...value, title: event.currentTarget.value }))
                }
              />
              <TextInput
                label="Εικονίδιο"
                value={deck.icon ?? ''}
                maxLength={12}
                onChange={(event) =>
                  setDeck((value) => ({ ...value, icon: event.currentTarget.value }))
                }
              />
              <TextInput
                label="Κατηγορία"
                value={deck.category}
                maxLength={60}
                onChange={(event) =>
                  setDeck((value) => ({ ...value, category: event.currentTarget.value }))
                }
              />
            </Group>
            <Textarea
              label="Περιγραφή"
              value={deck.description ?? ''}
              maxLength={240}
              onChange={(event) =>
                setDeck((value) => ({ ...value, description: event.currentTarget.value }))
              }
            />
            <Checkbox
              label="Ενεργή για Kids"
              checked={deck.enabled}
              onChange={(event) =>
                setDeck((value) => ({ ...value, enabled: event.currentTarget.checked }))
              }
            />
          </Stack>
        </Card>

        {capabilities ? (
          <Card withBorder padding="lg">
            <Title order={3} mb="md">
              Συμβατότητα παιχνιδιών
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {(
                [
                  ['LEARN_AND_CHOOSE', capabilities.learnAndChoose],
                  ['MEMORY_PAIRS', capabilities.memoryPairs],
                  ['MATCHING', capabilities.matching],
                  ['ODD_ONE_OUT', capabilities.oddOneOut],
                  ['COMPARE', capabilities.compare],
                  ['CLASSIFY', capabilities.classify],
                ] as const
              ).map(([mode, supported]) => (
                <div key={mode}>
                  <Badge color={supported ? 'teal' : 'gray'}>
                    {supported ? '✓' : '✗'} {modeLabels[mode]}
                  </Badge>
                  {!supported && capabilities.reasons[mode] ? (
                    <Text size="sm" c="dimmed">
                      {capabilities.reasons[mode]}
                    </Text>
                  ) : null}
                </div>
              ))}
            </SimpleGrid>
          </Card>
        ) : null}

        <Card withBorder padding="lg">
          <Title order={3} mb="md">
            Κάρτες
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="lg">
            {customCards.map((item, cardIndex) => {
              const asset = KIDS_ASSETS.get(item.assetId)
              return (
                <Card withBorder key={item.id} ta="center">
                  {item.assetUrl ? (
                    <img className="parent-card-preview-image" src={item.assetUrl} alt="" />
                  ) : (
                    <Text fz={64}>{asset?.symbol ?? '🖼️'}</Text>
                  )}
                  <Text fw={700}>{item.title}</Text>
                  <Text size="sm">{item.narration}</Text>
                  <Group justify="center" mt="sm">
                    <Button
                      size="xs"
                      variant="subtle"
                      disabled={cardIndex === 0}
                      aria-label="Μετακίνηση επάνω"
                      onClick={() => {
                        if (cardIndex === 0) return
                        const cardIds = [...deck.cardIds]
                        const previous = cardIds[cardIndex - 1]!
                        cardIds[cardIndex - 1] = cardIds[cardIndex]!
                        cardIds[cardIndex] = previous
                        const next = { ...deck, cardIds }
                        setDeck(next)
                        saveDeck.mutate(next)
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      disabled={cardIndex === customCards.length - 1}
                      aria-label="Μετακίνηση κάτω"
                      onClick={() => {
                        if (cardIndex >= customCards.length - 1) return
                        const cardIds = [...deck.cardIds]
                        const nextCard = cardIds[cardIndex + 1]!
                        cardIds[cardIndex + 1] = cardIds[cardIndex]!
                        cardIds[cardIndex] = nextCard
                        const next = { ...deck, cardIds }
                        setDeck(next)
                        saveDeck.mutate(next)
                      }}
                    >
                      ↓
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setEditingCardId(item.id)
                        setCard({
                          title: item.title,
                          narration: item.narration,
                          category: item.category,
                          tags: item.tags,
                          assetId: item.assetId,
                          alternativeNarration: item.alternativeNarration ?? '',
                          enabled: item.enabled,
                          color: item.attributes?.color ?? '',
                          size: item.attributes?.size ?? '',
                          location: item.attributes?.location ?? '',
                          count: item.attributes?.count?.toString() ?? '',
                        })
                      }}
                    >
                      Επεξεργασία
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => archiveCard.mutate(item.id)}
                    >
                      Αρχειοθέτηση
                    </Button>
                  </Group>
                </Card>
              )
            })}
          </SimpleGrid>
          <Stack>
            <Group grow>
              <TextInput
                label="Τίτλος"
                value={card.title}
                onChange={(event) =>
                  setCard((value) => ({ ...value, title: event.currentTarget.value }))
                }
              />
              <TextInput
                label="Ελληνική αφήγηση"
                value={card.narration}
                onChange={(event) =>
                  setCard((value) => ({ ...value, narration: event.currentTarget.value }))
                }
              />
              <TextInput
                label="Κατηγορία"
                value={card.category}
                onChange={(event) =>
                  setCard((value) => ({ ...value, category: event.currentTarget.value }))
                }
              />
            </Group>
            <Group grow>
              <NativeSelect
                label="Υπάρχον asset"
                value={card.assetId}
                data={[{ value: '', label: 'Επιλέξτε…' }, ...assetOptions]}
                onChange={(event) =>
                  setCard((value) => ({ ...value, assetId: event.currentTarget.value }))
                }
              />
              <FileInput
                label="ή μεταφόρτωση εικόνας"
                accept="image/jpeg,image/png,image/webp"
                value={image}
                onChange={setImage}
                clearable
              />
              <TagsInput
                label="Ετικέτες"
                value={card.tags}
                onChange={(tags) => setCard((value) => ({ ...value, tags }))}
              />
            </Group>
            <Group grow>
              <TextInput
                label="Χρώμα"
                value={card.color}
                onChange={(event) =>
                  setCard((value) => ({ ...value, color: event.currentTarget.value }))
                }
              />
              <TextInput
                label="Μέγεθος"
                value={card.size}
                onChange={(event) =>
                  setCard((value) => ({ ...value, size: event.currentTarget.value }))
                }
              />
              <TextInput
                label="Τοποθεσία"
                value={card.location}
                onChange={(event) =>
                  setCard((value) => ({ ...value, location: event.currentTarget.value }))
                }
              />
              <TextInput
                label="Πλήθος"
                type="number"
                min={0}
                max={20}
                value={card.count}
                onChange={(event) =>
                  setCard((value) => ({ ...value, count: event.currentTarget.value }))
                }
              />
            </Group>
            <Button
              onClick={() => addCard.mutate()}
              loading={addCard.isPending}
              disabled={
                !deck.title ||
                !card.title.trim() ||
                !card.narration.trim() ||
                (!card.assetId && !image)
              }
            >
              {editingCardId ? 'Αποθήκευση κάρτας' : 'Προσθήκη κάρτας'}
            </Button>
          </Stack>
        </Card>

        <Card withBorder padding="lg">
          <Title order={3}>Ρητή σχέση</Title>
          <Text c="dimmed" mb="md">
            Παράδειγμα: «Μέλισσα → παράγει → μέλι». Δεν γίνεται αυτόματη εξαγωγή από κείμενο.
          </Text>
          <Group grow align="end">
            <NativeSelect
              label="Πηγή"
              data={[{ value: '', label: 'Επιλέξτε…' }, ...cardOptions]}
              value={relationship.sourceCardId}
              onChange={(event) =>
                setRelationship((value) => ({ ...value, sourceCardId: event.currentTarget.value }))
              }
            />
            <NativeSelect
              label="Σχέση"
              data={relationshipTypes}
              value={relationship.type}
              onChange={(event) =>
                setRelationship((value) => ({
                  ...value,
                  type: event.currentTarget.value as KidsRelationshipType,
                }))
              }
            />
            <NativeSelect
              label="Στόχος"
              data={[{ value: '', label: 'Επιλέξτε…' }, ...cardOptions]}
              value={relationship.targetCardId}
              onChange={(event) =>
                setRelationship((value) => ({ ...value, targetCardId: event.currentTarget.value }))
              }
            />
            <Button
              onClick={() => saveRelationship.mutate()}
              disabled={
                !relationship.sourceCardId ||
                !relationship.targetCardId ||
                relationship.sourceCardId === relationship.targetCardId
              }
            >
              Αποθήκευση σχέσης
            </Button>
          </Group>
          <Stack gap="xs" mt="md">
            {content.data?.relationships
              .filter(
                (item) =>
                  item.origin === 'CUSTOM' &&
                  (deck.cardIds.includes(item.sourceCardId) ||
                    deck.cardIds.includes(item.targetCardId)),
              )
              .map((item) => (
                <Group justify="space-between" key={item.id}>
                  <Text size="sm">
                    {content.data.cards.find((card) => card.id === item.sourceCardId)?.title ??
                      item.sourceCardId}{' '}
                    → {item.type} →{' '}
                    {content.data.cards.find((card) => card.id === item.targetCardId)?.title ??
                      item.targetCardId}
                  </Text>
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    onClick={() => archiveRelationship.mutate(item.id)}
                  >
                    Αρχειοθέτηση
                  </Button>
                </Group>
              ))}
          </Stack>
        </Card>
      </Stack>
    </div>
  )
}
