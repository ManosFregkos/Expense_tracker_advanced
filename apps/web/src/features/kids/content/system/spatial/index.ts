import type { KidsDifficulty, SpatialConcept, SpatialScenario } from '@family-expense-tracker/shared'
import type { IllustratedAsset } from '../advanced'

type SceneId =
  | 'ball-inside-box'
  | 'ball-outside-box'
  | 'bird-above-table'
  | 'bird-below-table'
  | 'cat-front-chair'
  | 'cat-behind-chair'
  | 'apple-next-cup'
  | 'toy-between-blocks'
  | 'toy-far-blocks'

const labels: Record<SceneId, string> = {
  'ball-inside-box': 'η μπάλα μέσα στο κουτί',
  'ball-outside-box': 'η μπάλα έξω από το κουτί',
  'bird-above-table': 'το πουλί πάνω από το τραπέζι',
  'bird-below-table': 'το πουλί κάτω από το τραπέζι',
  'cat-front-chair': 'η γάτα μπροστά από την καρέκλα',
  'cat-behind-chair': 'η γάτα πίσω από την καρέκλα',
  'apple-next-cup': 'το μήλο δίπλα στο ποτήρι',
  'toy-between-blocks': 'το παιχνίδι ανάμεσα στα τουβλάκια',
  'toy-far-blocks': 'το παιχνίδι μακριά από τα τουβλάκια',
}

function scenario(
  id: string,
  concept: SpatialConcept,
  narration: string,
  correct: SceneId,
  distractors: SceneId[],
  explanationNarration: string,
  difficulty: KidsDifficulty,
): SpatialScenario {
  const sceneIds = [correct, ...distractors]
  return {
    id,
    concept,
    narration,
    promptStyle: 'FIND_CORRECT_SCENE',
    choices: sceneIds.map((sceneId) => ({
      id: `${id}-${sceneId}`,
      assetId: `spatial-${sceneId}`,
      narration: labels[sceneId],
    })),
    correctChoiceId: `${id}-${correct}`,
    explanationNarration,
    difficulty,
    enabled: true,
    origin: 'SYSTEM',
  }
}

export const SPATIAL_ASSETS = new Map<string, IllustratedAsset>(
  (Object.keys(labels) as SceneId[]).map((id) => [
    `spatial-${id}`,
    {
      symbol: '📍',
      color: '#f3fbf8',
      label: labels[id],
      url: `/kids-assets/spatial-${id}.svg`,
    },
  ]),
)

export const SYSTEM_SPATIAL_SCENARIOS: SpatialScenario[] = [
  scenario('spatial-inside-ball', 'INSIDE', 'Πού είναι η μπάλα μέσα στο κουτί;', 'ball-inside-box', ['ball-outside-box', 'apple-next-cup'], 'Μπράβο! Η μπάλα είναι μέσα στο κουτί.', 1),
  scenario('spatial-outside-ball', 'OUTSIDE', 'Πού είναι η μπάλα έξω από το κουτί;', 'ball-outside-box', ['ball-inside-box', 'apple-next-cup'], 'Μπράβο! Η μπάλα είναι έξω από το κουτί.', 1),
  scenario('spatial-above-bird', 'ABOVE', 'Πού είναι το πουλί πάνω από το τραπέζι;', 'bird-above-table', ['bird-below-table', 'apple-next-cup'], 'Μπράβο! Το πουλί είναι πάνω από το τραπέζι.', 1),
  scenario('spatial-below-bird', 'BELOW', 'Πού είναι το πουλί κάτω από το τραπέζι;', 'bird-below-table', ['bird-above-table', 'apple-next-cup'], 'Μπράβο! Το πουλί είναι κάτω από το τραπέζι.', 1),
  scenario('spatial-front-cat', 'IN_FRONT_OF', 'Πού είναι η γάτα μπροστά από την καρέκλα;', 'cat-front-chair', ['cat-behind-chair', 'apple-next-cup'], 'Μπράβο! Η γάτα είναι μπροστά από την καρέκλα.', 2),
  scenario('spatial-behind-cat', 'BEHIND', 'Πού είναι η γάτα πίσω από την καρέκλα;', 'cat-behind-chair', ['cat-front-chair', 'apple-next-cup'], 'Μπράβο! Η γάτα είναι πίσω από την καρέκλα.', 2),
  scenario('spatial-next-apple', 'NEXT_TO', 'Πού είναι το μήλο δίπλα στο ποτήρι;', 'apple-next-cup', ['toy-far-blocks', 'toy-between-blocks'], 'Μπράβο! Το μήλο είναι δίπλα στο ποτήρι.', 2),
  scenario('spatial-between-toy', 'BETWEEN', 'Πού είναι το παιχνίδι ανάμεσα στα δύο τουβλάκια;', 'toy-between-blocks', ['toy-far-blocks', 'apple-next-cup'], 'Μπράβο! Το παιχνίδι είναι ανάμεσα στα τουβλάκια.', 3),
]
