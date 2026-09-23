import {
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { EmotionType, EverydayTopic, KidsDifficulty } from '@family-expense-tracker/shared'
import { api } from '../../../../lib/callables'
import { useHousehold } from '../../../households/HouseholdProvider'
import { KIDS_ASSETS } from '../../content/system'
import { KidsContentRepository } from '../../content/KidsContentRepository'

function newId(prefix: string) {
  return prefix + '-' + crypto.randomUUID().replaceAll('-', '')
}

const topics: EverydayTopic[] = [
  'HYGIENE',
  'KINDNESS',
  'SAFETY',
  'HOME',
  'ROUTINE',
  'ANIMALS',
  'SOCIAL',
  'FOOD',
]
const emotions: EmotionType[] = ['HAPPY', 'SAD', 'ANGRY', 'SCARED', 'SURPRISED', 'TIRED']

export function KidsParentScenariosPage() {
  const { household } = useHousehold()
  const queryClient = useQueryClient()
  const content = useQuery({
    queryKey: ['kids', household?.id, 'parent-scenarios'],
    enabled: Boolean(household),
    queryFn: async () => {
      const repository = new KidsContentRepository(household!.id)
      const [everyday, sequences, emotions] = await Promise.all([
        repository.getEverydayScenarios(),
        repository.getSequences(),
        repository.getEmotionScenarios(),
      ])
      return { everyday, sequences, emotions }
    },
  })
  const assets = [...KIDS_ASSETS.entries()].slice(0, 180).map(([value, asset]) => ({
    value,
    label: (asset.symbol || '🖼️') + ' ' + (asset.label || value),
  }))
  const [everyday, setEveryday] = useState({
    narration: '',
    topic: 'ROUTINE' as EverydayTopic,
    choiceA: '',
    assetA: 'hands-before-food',
    choiceB: '',
    assetB: 'road-hand',
    explanation: '',
    difficulty: 1 as KidsDifficulty,
    enabled: true,
  })
  const [sequence, setSequence] = useState({
    title: '',
    narration: 'Τι έρχεται μετά;',
    labels: ['', '', ''],
    assets: ['seed-flower', 'hands-before-food', 'gift-happy'],
    difficulty: 1 as KidsDifficulty,
    enabled: true,
  })
  const [emotion, setEmotion] = useState({
    narration: '',
    sceneAssetId: 'gift-happy',
    expected: 'HAPPY' as EmotionType,
    alternative: 'SAD' as EmotionType,
    explanation: '',
    difficulty: 1 as KidsDifficulty,
    enabled: true,
  })
  const [editingEverydayId, setEditingEverydayId] = useState<string>()
  const [editingSequenceId, setEditingSequenceId] = useState<string>()
  const [editingEmotionId, setEditingEmotionId] = useState<string>()
  const save = async (
    kind: 'EVERYDAY_SCENARIO' | 'SEQUENCE' | 'EMOTION_SCENARIO',
    content: Record<string, unknown>,
  ) => {
    try {
      await api.saveKidsCustomContent({ householdId: household!.id, kind, content })
      await queryClient.invalidateQueries({ queryKey: ['kids', household?.id, 'parent-scenarios'] })
      notifications.show({ color: 'teal', message: 'Το σενάριο αποθηκεύτηκε.' })
    } catch {
      notifications.show({ color: 'red', message: 'Ελέγξτε τα πεδία και δοκιμάστε ξανά.' })
    }
  }
  const archive = async (
    kind: 'EVERYDAY_SCENARIO' | 'SEQUENCE' | 'EMOTION_SCENARIO',
    contentId: string,
  ) => {
    await api.archiveKidsCustomContent({ householdId: household!.id, kind, contentId })
    await queryClient.invalidateQueries({ queryKey: ['kids', household?.id, 'parent-scenarios'] })
  }
  return (
    <div className="page">
      <Title order={1}>Δημιουργία σεναρίων</Title>
      <Text c="dimmed" mb="lg">
        Χρησιμοποιήστε καθαρές εικόνες και μία μόνο προτιμώμενη ή αναμενόμενη απάντηση.
      </Text>
      {content.data ? (
        <Card withBorder padding="lg" mb="lg">
          <Title order={3} mb="sm">
            Προσαρμοσμένα σενάρια
          </Title>
          <Stack gap="xs">
            {content.data.everyday
              .filter((item) => item.origin === 'CUSTOM')
              .map((item) => (
                <Group justify="space-between" key={item.id}>
                  <Text>Καθημερινό · {item.narration}</Text>
                  <Group>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setEditingEverydayId(item.id)
                        setEveryday({
                          narration: item.narration,
                          topic: item.topic,
                          choiceA:
                            item.choices.find((choice) => choice.id === item.preferredChoiceId)
                              ?.narration ?? '',
                          assetA:
                            item.choices.find((choice) => choice.id === item.preferredChoiceId)
                              ?.assetId ?? '',
                          choiceB:
                            item.choices.find((choice) => choice.id !== item.preferredChoiceId)
                              ?.narration ?? '',
                          assetB:
                            item.choices.find((choice) => choice.id !== item.preferredChoiceId)
                              ?.assetId ?? '',
                          explanation: item.explanationNarration,
                          difficulty: item.difficulty,
                          enabled: item.enabled,
                        })
                      }}
                    >
                      Επεξεργασία
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => void archive('EVERYDAY_SCENARIO', item.id)}
                    >
                      Αρχειοθέτηση
                    </Button>
                  </Group>
                </Group>
              ))}
            {content.data.sequences
              .filter((item) => item.origin === 'CUSTOM')
              .map((item) => (
                <Group justify="space-between" key={item.id}>
                  <Text>Ακολουθία · {item.title}</Text>
                  <Group>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setEditingSequenceId(item.id)
                        setSequence({
                          title: item.title ?? '',
                          narration: item.narration,
                          labels: item.steps.slice(0, 3).map((step) => step.narration),
                          assets: item.steps.slice(0, 3).map((step) => step.assetId),
                          difficulty: item.difficulty,
                          enabled: item.enabled,
                        })
                      }}
                    >
                      Επεξεργασία
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => void archive('SEQUENCE', item.id)}
                    >
                      Αρχειοθέτηση
                    </Button>
                  </Group>
                </Group>
              ))}
            {content.data.emotions
              .filter((item) => item.origin === 'CUSTOM')
              .map((item) => (
                <Group justify="space-between" key={item.id}>
                  <Text>Συναίσθημα · {item.narration}</Text>
                  <Group>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setEditingEmotionId(item.id)
                        setEmotion({
                          narration: item.narration,
                          sceneAssetId: item.sceneAssetId,
                          expected: item.expectedEmotion,
                          alternative:
                            item.options.find((option) => option !== item.expectedEmotion) ?? 'SAD',
                          explanation: item.explanationNarration ?? '',
                          difficulty: item.difficulty,
                          enabled: item.enabled,
                        })
                      }}
                    >
                      Επεξεργασία
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => void archive('EMOTION_SCENARIO', item.id)}
                    >
                      Αρχειοθέτηση
                    </Button>
                  </Group>
                </Group>
              ))}
          </Stack>
        </Card>
      ) : null}
      <Tabs defaultValue="everyday">
        <Tabs.List>
          <Tabs.Tab value="everyday">Καθημερινές επιλογές</Tabs.Tab>
          <Tabs.Tab value="sequence">Ακολουθίες</Tabs.Tab>
          <Tabs.Tab value="emotion">Συναισθήματα</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="everyday" pt="lg">
          <Card withBorder padding="lg">
            <Stack>
              <Textarea
                label="Ερώτηση / αφήγηση"
                value={everyday.narration}
                onChange={(event) =>
                  setEveryday((value) => ({ ...value, narration: event.currentTarget.value }))
                }
              />
              <Group grow>
                <NativeSelect
                  label="Θέμα"
                  data={topics}
                  value={everyday.topic}
                  onChange={(event) =>
                    setEveryday((value) => ({
                      ...value,
                      topic: event.currentTarget.value as EverydayTopic,
                    }))
                  }
                />
                <NumberInput
                  label="Δυσκολία"
                  min={1}
                  max={4}
                  value={everyday.difficulty}
                  onChange={(value) =>
                    setEveryday((item) => ({
                      ...item,
                      difficulty: Number(value) as KidsDifficulty,
                    }))
                  }
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Προτιμώμενη επιλογή"
                  value={everyday.choiceA}
                  onChange={(event) =>
                    setEveryday((value) => ({ ...value, choiceA: event.currentTarget.value }))
                  }
                />
                <NativeSelect
                  label="Εικόνα A"
                  data={assets}
                  value={everyday.assetA}
                  onChange={(event) =>
                    setEveryday((value) => ({ ...value, assetA: event.currentTarget.value }))
                  }
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Άλλη επιλογή"
                  value={everyday.choiceB}
                  onChange={(event) =>
                    setEveryday((value) => ({ ...value, choiceB: event.currentTarget.value }))
                  }
                />
                <NativeSelect
                  label="Εικόνα B"
                  data={assets}
                  value={everyday.assetB}
                  onChange={(event) =>
                    setEveryday((value) => ({ ...value, assetB: event.currentTarget.value }))
                  }
                />
              </Group>
              <Textarea
                label="Ήρεμη εξήγηση"
                value={everyday.explanation}
                onChange={(event) =>
                  setEveryday((value) => ({ ...value, explanation: event.currentTarget.value }))
                }
              />
              <Checkbox
                label="Ενεργό"
                checked={everyday.enabled}
                onChange={(event) =>
                  setEveryday((value) => ({ ...value, enabled: event.currentTarget.checked }))
                }
              />
              <Button
                disabled={
                  !everyday.narration ||
                  !everyday.choiceA ||
                  !everyday.choiceB ||
                  !everyday.explanation
                }
                onClick={() => {
                  const id = editingEverydayId ?? newId('everyday')
                  void save('EVERYDAY_SCENARIO', {
                    id,
                    topic: everyday.topic,
                    narration: everyday.narration,
                    choices: [
                      { id: id + '-a', assetId: everyday.assetA, narration: everyday.choiceA },
                      { id: id + '-b', assetId: everyday.assetB, narration: everyday.choiceB },
                    ],
                    preferredChoiceId: id + '-a',
                    explanationNarration: everyday.explanation,
                    difficulty: everyday.difficulty,
                    enabled: everyday.enabled,
                    origin: 'CUSTOM',
                  })
                }}
              >
                Αποθήκευση καθημερινού σεναρίου
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="sequence" pt="lg">
          <Card withBorder padding="lg">
            <Stack>
              <TextInput
                label="Τίτλος"
                value={sequence.title}
                onChange={(event) =>
                  setSequence((value) => ({ ...value, title: event.currentTarget.value }))
                }
              />
              <Textarea
                label="Ερώτηση"
                value={sequence.narration}
                onChange={(event) =>
                  setSequence((value) => ({ ...value, narration: event.currentTarget.value }))
                }
              />
              {sequence.labels.map((label, index) => (
                <Group grow key={index}>
                  <TextInput
                    label={'Βήμα ' + (index + 1)}
                    value={label}
                    onChange={(event) =>
                      setSequence((value) => ({
                        ...value,
                        labels: value.labels.map((item, itemIndex) =>
                          itemIndex === index ? event.currentTarget.value : item,
                        ),
                      }))
                    }
                  />
                  <NativeSelect
                    label="Εικόνα"
                    data={assets}
                    value={sequence.assets[index]}
                    onChange={(event) =>
                      setSequence((value) => ({
                        ...value,
                        assets: value.assets.map((item, itemIndex) =>
                          itemIndex === index ? event.currentTarget.value : item,
                        ),
                      }))
                    }
                  />
                </Group>
              ))}
              <NumberInput
                label="Δυσκολία"
                min={1}
                max={4}
                value={sequence.difficulty}
                onChange={(value) =>
                  setSequence((item) => ({ ...item, difficulty: Number(value) as KidsDifficulty }))
                }
              />
              <Button
                disabled={!sequence.title || sequence.labels.some((item) => !item)}
                onClick={() => {
                  const id = editingSequenceId ?? newId('sequence')
                  void save('SEQUENCE', {
                    id,
                    title: sequence.title,
                    steps: sequence.labels.map((narration, index) => ({
                      id: id + '-step-' + (index + 1),
                      assetId: sequence.assets[index],
                      narration,
                    })),
                    narration: sequence.narration,
                    explanationNarration: 'Αυτή είναι η σωστή σειρά.',
                    difficulty: sequence.difficulty,
                    category: 'CUSTOM',
                    enabled: sequence.enabled,
                    origin: 'CUSTOM',
                  })
                }}
              >
                Αποθήκευση ακολουθίας
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="emotion" pt="lg">
          <Alert color="yellow" mb="md">
            Χρησιμοποιήστε μια καθαρή, εικονογραφημένη κατάσταση με μία μόνο intended απάντηση. Μην
            χρησιμοποιείτε αμφίσημες πραγματικές φωτογραφίες.
          </Alert>
          <Card withBorder padding="lg">
            <Stack>
              <NativeSelect
                label="Εικόνα σκηνής"
                data={assets}
                value={emotion.sceneAssetId}
                onChange={(event) =>
                  setEmotion((value) => ({ ...value, sceneAssetId: event.currentTarget.value }))
                }
              />
              <Textarea
                label="Ερώτηση / αφήγηση"
                value={emotion.narration}
                onChange={(event) =>
                  setEmotion((value) => ({ ...value, narration: event.currentTarget.value }))
                }
              />
              <Group grow>
                <NativeSelect
                  label="Αναμενόμενο συναίσθημα"
                  data={emotions}
                  value={emotion.expected}
                  onChange={(event) =>
                    setEmotion((value) => ({
                      ...value,
                      expected: event.currentTarget.value as EmotionType,
                    }))
                  }
                />
                <NativeSelect
                  label="Εναλλακτική"
                  data={emotions.filter((item) => item !== emotion.expected)}
                  value={emotion.alternative}
                  onChange={(event) =>
                    setEmotion((value) => ({
                      ...value,
                      alternative: event.currentTarget.value as EmotionType,
                    }))
                  }
                />
              </Group>
              <Textarea
                label="Εξήγηση"
                value={emotion.explanation}
                onChange={(event) =>
                  setEmotion((value) => ({ ...value, explanation: event.currentTarget.value }))
                }
              />
              <Button
                disabled={
                  !emotion.narration ||
                  !emotion.explanation ||
                  emotion.expected === emotion.alternative
                }
                onClick={() =>
                  void save('EMOTION_SCENARIO', {
                    id: editingEmotionId ?? newId('emotion'),
                    sceneAssetId: emotion.sceneAssetId,
                    narration: emotion.narration,
                    options: [emotion.expected, emotion.alternative],
                    expectedEmotion: emotion.expected,
                    explanationNarration: emotion.explanation,
                    difficulty: emotion.difficulty,
                    enabled: emotion.enabled,
                    origin: 'CUSTOM',
                  })
                }
              >
                Αποθήκευση σεναρίου συναισθήματος
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
