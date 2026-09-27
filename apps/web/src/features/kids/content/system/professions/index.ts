import type { LearningCard, LearningDeck, LearningRelationship } from '@family-expense-tracker/shared'
import type { IllustratedAsset } from '../advanced'

type ProfessionSeed = readonly [id: string, title: string, symbol: string, narration: string]
type ToolSeed = readonly [id: string, title: string, symbol: string, narration: string]

const professionSeeds: ProfessionSeed[] = [
  ['profession-doctor', 'γιατρός', '🧑‍⚕️', 'Αυτός είναι ο γιατρός.'],
  ['profession-cook', 'μάγειρας', '🧑‍🍳', 'Αυτός είναι ο μάγειρας.'],
  ['profession-firefighter', 'πυροσβέστης', '🧑‍🚒', 'Αυτός είναι ο πυροσβέστης.'],
  ['profession-painter', 'ζωγράφος', '🧑‍🎨', 'Αυτός είναι ο ζωγράφος.'],
  ['profession-builder', 'οικοδόμος', '👷', 'Αυτός είναι ο οικοδόμος.'],
  ['profession-police-officer', 'αστυνομικός', '👮', 'Αυτός είναι ο αστυνομικός.'],
  ['profession-farmer', 'αγρότης', '🧑‍🌾', 'Αυτός είναι ο αγρότης.'],
  ['profession-musician', 'μουσικός', '🧑‍🎤', 'Αυτός είναι ο μουσικός.'],
  ['profession-teacher', 'δάσκαλος', '🧑‍🏫', 'Αυτός είναι ο δάσκαλος.'],
  ['profession-dentist', 'οδοντίατρος', '🦷', 'Αυτός είναι ο οδοντίατρος.'],
]

const toolSeeds: ToolSeed[] = [
  ['tool-stethoscope', 'στηθοσκόπιο', '🩺', 'Αυτό είναι το στηθοσκόπιο.'],
  ['tool-pan', 'τηγάνι', '🍳', 'Αυτό είναι το τηγάνι.'],
  ['tool-fire-hose', 'πυροσβεστική μάνικα', '🧯', 'Αυτή είναι η πυροσβεστική μάνικα.'],
  ['tool-paintbrush', 'πινέλο', '🖌️', 'Αυτό είναι το πινέλο.'],
  ['tool-hammer', 'σφυρί', '🔨', 'Αυτό είναι το σφυρί.'],
  ['tool-police-badge', 'σήμα', '🛡️', 'Αυτό είναι το σήμα του αστυνομικού.'],
  ['tool-watering-can', 'ποτιστήρι', '🪴', 'Αυτό είναι το ποτιστήρι.'],
  ['tool-guitar', 'κιθάρα', '🎸', 'Αυτή είναι η κιθάρα.'],
  ['tool-book', 'βιβλίο', '📘', 'Αυτό είναι το βιβλίο.'],
  ['tool-tooth-mirror', 'καθρεφτάκι δοντιών', '🪞', 'Αυτό είναι το καθρεφτάκι του οδοντιάτρου.'],
]

export const PROFESSION_CARDS: LearningCard[] = [
  ...professionSeeds.map(([id, title, , narration]) => ({
    id,
    deckId: 'professions',
    title,
    narration,
    assetId: id,
    category: 'PROFESSION',
    tags: ['profession'],
    difficulty: 1 as const,
    enabled: true,
    origin: 'SYSTEM' as const,
    contentVersion: 4,
  })),
  ...toolSeeds.map(([id, title, , narration]) => ({
    id,
    deckId: 'professions',
    title,
    narration,
    assetId: id,
    category: 'PROFESSION_TOOL',
    tags: ['profession-tool'],
    difficulty: 1 as const,
    enabled: true,
    origin: 'SYSTEM' as const,
    contentVersion: 4,
  })),
]

export const PROFESSIONS_DECK: LearningDeck = {
  id: 'professions',
  title: 'Επαγγέλματα',
  description: 'Ποιος χρησιμοποιεί τι;',
  narrationTitle: 'Επαγγέλματα',
  category: 'PROFESSIONS',
  ageBand: '3-5',
  supportedModes: ['LEARN_AND_CHOOSE', 'MATCHING'],
  cardIds: PROFESSION_CARDS.map((card) => card.id),
  enabled: true,
  origin: 'SYSTEM',
  contentVersion: 4,
  icon: '👥',
}

const pairs = [
  ['profession-doctor', 'tool-stethoscope', 'Ο γιατρός χρησιμοποιεί στηθοσκόπιο.'],
  ['profession-cook', 'tool-pan', 'Ο μάγειρας χρησιμοποιεί τηγάνι.'],
  ['profession-firefighter', 'tool-fire-hose', 'Ο πυροσβέστης χρησιμοποιεί πυροσβεστική μάνικα.'],
  ['profession-painter', 'tool-paintbrush', 'Ο ζωγράφος χρησιμοποιεί πινέλο.'],
  ['profession-builder', 'tool-hammer', 'Ο οικοδόμος χρησιμοποιεί σφυρί.'],
  ['profession-police-officer', 'tool-police-badge', 'Ο αστυνομικός χρησιμοποιεί το σήμα του.'],
  ['profession-farmer', 'tool-watering-can', 'Ο αγρότης χρησιμοποιεί ποτιστήρι.'],
  ['profession-musician', 'tool-guitar', 'Ο μουσικός χρησιμοποιεί κιθάρα.'],
  ['profession-teacher', 'tool-book', 'Ο δάσκαλος χρησιμοποιεί βιβλίο.'],
  ['profession-dentist', 'tool-tooth-mirror', 'Ο οδοντίατρος χρησιμοποιεί καθρεφτάκι δοντιών.'],
] as const

export const PROFESSION_RELATIONSHIPS: LearningRelationship[] = pairs.map(
  ([professionId, toolId, narration]) => ({
    id: `${professionId}-${toolId}`,
    sourceCardId: professionId,
    targetCardId: toolId,
    type: 'USES',
    narration,
    enabled: true,
    origin: 'SYSTEM',
  }),
)

export const PROFESSION_ASSETS = new Map<string, IllustratedAsset>([
  ...professionSeeds.map(([id, , symbol, narration]) => [id, { symbol, color: '#eaf7ff', label: narration }] as const),
  ...toolSeeds.map(([id, , symbol, narration]) => [id, { symbol, color: '#fff7e8', label: narration }] as const),
])
