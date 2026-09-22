export interface KidAsset {
  id: string
  glyph: string
  label: string
  color: string
}
export const KIDS_SYSTEM_CONTENT_VERSION = 1
const rows = [
  ['fish', '🐟', 'ψάρι', '#66c6e8'],
  ['octopus', '🐙', 'χταπόδι', '#d384cb'],
  ['dolphin', '🐬', 'δελφίνι', '#88bde5'],
  ['turtle', '🐢', 'χελώνα', '#97c982'],
  ['crab', '🦀', 'καβούρι', '#ef8a75'],
  ['starfish', '⭐', 'αστερίας', '#f4cf73'],
  ['shell', '🐚', 'κοχύλι', '#e5a9a0'],
  ['seaweed', '🌿', 'φύκια', '#78b79a'],
  ['treasure', '🧰', 'θησαυρός', '#d8ae73'],
  ['elephant', '🐘', 'ελέφαντας', '#aab4bd'],
  ['monkey', '🐒', 'μαϊμού', '#c9a681'],
  ['parrot', '🦜', 'παπαγάλος', '#8ccbb1'],
  ['tiger', '🐅', 'τίγρης', '#eab26c'],
  ['snake', '🐍', 'φίδι', '#a6c978'],
  ['frog', '🐸', 'βάτραχος', '#9bd38a'],
  ['banana', '🍌', 'μπανάνα', '#f4da83'],
  ['butterfly', '🦋', 'πεταλούδα', '#9fa6e8'],
  ['tree', '🌳', 'δέντρο', '#89bd8b'],
  ['earth', '🌎', 'Γη', '#8fb8ed'],
  ['moon', '🌙', 'Σελήνη', '#e9dba6'],
  ['sun', '☀️', 'Ήλιος', '#f3cd68'],
  ['rocket', '🚀', 'πύραυλος', '#d2a5bd'],
  ['astronaut', '👩‍🚀', 'αστροναύτης', '#d9d5e9'],
  ['stars', '✨', 'αστέρια', '#f1d580'],
  ['planet', '🪐', 'πλανήτης', '#d8a2bb'],
  ['satellite', '🛰️', 'δορυφόρος', '#a4c4d4'],
  ['comet', '☄️', 'κομήτης', '#edb79a'],
  ['apple', '🍎', 'μήλο', '#ed8784'],
  ['pear', '🍐', 'αχλάδι', '#bdcf80'],
  ['orange', '🍊', 'πορτοκάλι', '#f1b874'],
  ['cat', '🐈', 'γάτα', '#deb39a'],
  ['dog', '🐕', 'σκύλος', '#d4b69b'],
  ['bird', '🐦', 'πουλί', '#8cb8db'],
  ['flower', '🌼', 'λουλούδι', '#ebd487'],
  ['umbrella', '☂️', 'ομπρέλα', '#bf9cda'],
  ['cloud', '☁️', 'σύννεφο', '#c6d8df'],
  ['rain', '🌧️', 'βροχή', '#8abdd8'],
  ['water', '💧', 'νερό', '#91c9df'],
  ['ice', '🧊', 'πάγος', '#c5dfea'],
  ['cup', '🥛', 'ποτήρι', '#e4e6df'],
  ['pillow', '🛏️', 'μαξιλάρι', '#c9b6d9'],
  ['glasses', '🕶️', 'γυαλιά', '#b2b1bc'],
  ['sleep', '😴', 'ύπνος', '#b9acd9'],
  ['ball', '⚽', 'μπάλα', '#c3d4cf'],
  ['book', '📚', 'βιβλία', '#d9a4a4'],
  ['seed', '🌱', 'σπόρος', '#a9d49c'],
  ['bread', '🍞', 'ψωμί', '#e3bc87'],
  ['lamp', '💡', 'φως', '#f2d981'],
  ['hat', '👒', 'καπέλο', '#e9baaa'],
  ['shoes', '👟', 'παπούτσια', '#a9b6d9'],
  ['plate', '🍽️', 'πιάτο', '#d8d7ce'],
  ['friend', '🧒', 'φίλος', '#dcbfa9'],
  ['hand', '🤝', 'βοήθεια', '#d4b99d'],
  ['towel', '🧺', 'πετσέτα', '#c4d5c1'],
] as const
export const assets: Record<string, KidAsset> = Object.fromEntries(
  rows.map(([id, glyph, label, color]) => [id, { id, glyph, label, color }]),
)
export const memoryPool = rows
  .filter(([id]) => !['treasure', 'astronaut', 'satellite', 'comet', 'friend', 'hand'].includes(id))
  .map(([id]) => id)

export interface ExplorerMission {
  id: string
  narrationText: string
  narrationAudioUrl?: string
  targetId: string
  difficulty: number
  skill: 'OBSERVATION' | 'VOCABULARY' | 'CLASSIFICATION' | 'COUNTING'
}
export interface ExplorerWorld {
  id: string
  contentVersion: number
  title: string
  backdrop: string
  objects: { id: string; x: number; y: number }[]
  missions: ExplorerMission[]
  reward: string
}
function world(
  id: string,
  title: string,
  backdrop: string,
  ids: string[],
  reward: string,
  prompts: [string, string, number, ExplorerMission['skill']][],
): ExplorerWorld {
  return {
    id,
    contentVersion: KIDS_SYSTEM_CONTENT_VERSION,
    title,
    backdrop,
    reward,
    objects: ids.map((item, index) => ({
      id: item,
      x: 12 + (index % 3) * 37,
      y: 20 + Math.floor(index / 3) * 27,
    })),
    missions: [
      ...ids.flatMap((targetId, index) => [
        {
          id: `${id}-find-${index}`,
          targetId,
          narrationText: `Βρες ${assets[targetId]?.label ?? targetId}!`,
          difficulty: 1,
          skill: 'OBSERVATION' as const,
        },
        {
          id: `${id}-where-${index}`,
          targetId,
          narrationText: `Πού είναι ${assets[targetId]?.label ?? targetId};`,
          difficulty: 1,
          skill: 'VOCABULARY' as const,
        },
      ]),
      ...prompts.map(([targetId, narrationText, difficulty, skill], index) => ({
        id: `${id}-${index}`,
        targetId,
        narrationText,
        difficulty,
        skill,
      })),
    ],
  }
}
export const worlds: ExplorerWorld[] = [
  world(
    'underwater',
    'Βυθός',
    'underwater',
    ['fish', 'octopus', 'dolphin', 'turtle', 'crab', 'starfish', 'shell', 'seaweed', 'treasure'],
    '🧰',
    [
      ['octopus', 'Βρες το χταπόδι!', 1, 'OBSERVATION'],
      ['turtle', 'Πού είναι η χελώνα;', 1, 'VOCABULARY'],
      ['dolphin', 'Βρες το δελφίνι!', 1, 'OBSERVATION'],
      ['starfish', 'Βρες τον αστερία!', 1, 'OBSERVATION'],
      ['crab', 'Πού είναι το καβούρι;', 1, 'VOCABULARY'],
      ['shell', 'Βρες το κοχύλι!', 1, 'OBSERVATION'],
      ['seaweed', 'Βρες τα φύκια!', 1, 'OBSERVATION'],
      ['fish', 'Βρες το ψάρι!', 1, 'OBSERVATION'],
      ['treasure', 'Πού κρύβεται ο θησαυρός;', 2, 'OBSERVATION'],
      ['octopus', 'Ποιο έχει οκτώ πλοκάμια;', 2, 'CLASSIFICATION'],
      ['turtle', 'Ποιο ζώο έχει καβούκι;', 2, 'CLASSIFICATION'],
      ['crab', 'Βρες κάτι κόκκινο!', 2, 'CLASSIFICATION'],
    ],
  ),
  world(
    'jungle',
    'Ζούγκλα',
    'jungle',
    ['elephant', 'monkey', 'parrot', 'tiger', 'snake', 'frog', 'banana', 'butterfly', 'tree'],
    '🦜',
    [
      ['elephant', 'Βρες τον ελέφαντα!', 1, 'OBSERVATION'],
      ['monkey', 'Βρες τη μαϊμού!', 1, 'OBSERVATION'],
      ['parrot', 'Βρες τον παπαγάλο!', 1, 'OBSERVATION'],
      ['tiger', 'Βρες την τίγρη!', 1, 'OBSERVATION'],
      ['snake', 'Βρες το φίδι!', 1, 'OBSERVATION'],
      ['frog', 'Βρες τον βάτραχο!', 1, 'OBSERVATION'],
      ['banana', 'Βρες την μπανάνα!', 1, 'OBSERVATION'],
      ['butterfly', 'Βρες την πεταλούδα!', 1, 'OBSERVATION'],
      ['tree', 'Βρες το δέντρο!', 1, 'OBSERVATION'],
      ['parrot', 'Ποιο πουλί μπορεί να πετάξει;', 2, 'CLASSIFICATION'],
      ['elephant', 'Ποιο ζώο είναι πολύ μεγάλο;', 2, 'CLASSIFICATION'],
      ['frog', 'Ποιο ζώο πηδάει κοντά στο νερό;', 2, 'CLASSIFICATION'],
    ],
  ),
  world(
    'space',
    'Διάστημα',
    'space',
    ['earth', 'moon', 'sun', 'rocket', 'astronaut', 'stars', 'planet', 'satellite', 'comet'],
    '🪐',
    [
      ['earth', 'Βρες τη Γη!', 1, 'OBSERVATION'],
      ['moon', 'Βρες τη Σελήνη!', 1, 'OBSERVATION'],
      ['sun', 'Βρες τον Ήλιο!', 1, 'OBSERVATION'],
      ['rocket', 'Βρες τον πύραυλο!', 1, 'OBSERVATION'],
      ['astronaut', 'Βρες την αστροναύτη!', 1, 'OBSERVATION'],
      ['stars', 'Βρες τα αστέρια!', 1, 'OBSERVATION'],
      ['planet', 'Βρες τον πλανήτη!', 1, 'OBSERVATION'],
      ['satellite', 'Βρες τον δορυφόρο!', 1, 'OBSERVATION'],
      ['comet', 'Βρες τον κομήτη!', 1, 'OBSERVATION'],
      ['sun', 'Τι μας δίνει φως;', 2, 'CLASSIFICATION'],
      ['rocket', 'Τι ταξιδεύει στο διάστημα;', 2, 'CLASSIFICATION'],
      ['earth', 'Σε ποιον πλανήτη ζούμε;', 2, 'VOCABULARY'],
    ],
  ),
]

export interface LogicScenario {
  id: string
  contentVersion?: number
  title: string
  narrationText: string
  narrationAudioUrl?: string
  illustrationAssetId: string
  difficulty: number
  skill: 'LOGIC' | 'CAUSE_EFFECT' | 'CLASSIFICATION'
  options: {
    id: string
    assetId: string
    label: string
    isPreferredAnswer: boolean
    explanationNarration?: string
    nextNodeId?: string
  }[]
  enabled?: boolean
}
function scenario(
  id: string,
  title: string,
  question: string,
  scene: string,
  answer: string,
  wrong1: string,
  wrong2: string,
  skill: LogicScenario['skill'] = 'CAUSE_EFFECT',
): LogicScenario {
  return {
    id,
    contentVersion: KIDS_SYSTEM_CONTENT_VERSION,
    title,
    narrationText: question,
    illustrationAssetId: scene,
    difficulty: 1,
    skill,
    options: [answer, wrong1, wrong2].map((assetId, index) => ({
      id: `${id}-${index}`,
      assetId,
      label: assets[assetId]?.label ?? assetId,
      isPreferredAnswer: index === 0,
      ...(index === 0 ? { explanationNarration: `Ναι! ${assets[assetId]?.label ?? ''}!` } : {}),
    })),
  }
}
export const logicScenarios: LogicScenario[] = [
  scenario(
    'rain',
    'Βροχή',
    'Βρέχει. Τι θα πάρουμε για να μη βραχούμε;',
    'rain',
    'umbrella',
    'glasses',
    'pillow',
  ),
  scenario('ice', 'Πάγος', 'Ο πάγος ζεσταίνεται. Τι γίνεται;', 'ice', 'water', 'tree', 'bread'),
  scenario('plant', 'Φυτό', 'Το φυτό διψάει. Τι του δίνουμε;', 'seed', 'water', 'shoes', 'plate'),
  scenario('sleepy', 'Ύπνος', 'Νυστάζουμε. Τι κάνουμε;', 'sleep', 'pillow', 'ball', 'umbrella'),
  scenario(
    'seed',
    'Σπόρος',
    'Φυτεύουμε έναν σπόρο. Τι μεγαλώνει;',
    'seed',
    'flower',
    'cup',
    'glasses',
  ),
  scenario('dark', 'Σκοτάδι', 'Είναι σκοτεινά. Τι ανάβουμε;', 'moon', 'lamp', 'bread', 'shoes'),
  scenario('wet', 'Βρεγμένο', 'Βραχήκαμε. Με τι σκουπιζόμαστε;', 'rain', 'towel', 'plate', 'ball'),
  scenario(
    'sunny',
    'Ήλιος',
    'Ο ήλιος λάμπει. Τι φοράμε στο κεφάλι;',
    'sun',
    'hat',
    'pillow',
    'cup',
  ),
  scenario('hungry', 'Πεινάμε', 'Πεινάμε. Τι μπορούμε να φάμε;', 'friend', 'bread', 'ball', 'book'),
  scenario(
    'read',
    'Βιβλίο',
    'Θέλουμε να διαβάσουμε. Τι ανοίγουμε;',
    'book',
    'book',
    'plate',
    'shoes',
    'LOGIC',
  ),
  scenario(
    'bird',
    'Πουλί',
    'Τι μπορεί να πετάξει στον ουρανό;',
    'cloud',
    'bird',
    'turtle',
    'cup',
    'CLASSIFICATION',
  ),
  scenario(
    'fish',
    'Ψάρι',
    'Ποιο ζώο ζει στο νερό;',
    'water',
    'fish',
    'cat',
    'dog',
    'CLASSIFICATION',
  ),
  scenario(
    'fruit',
    'Φρούτο',
    'Ποιο είναι φρούτο;',
    'apple',
    'pear',
    'book',
    'shoes',
    'CLASSIFICATION',
  ),
  scenario('cold', 'Κρύο', 'Κάνει κρύο. Τι φοράμε στα πόδια;', 'cloud', 'shoes', 'plate', 'bread'),
  scenario(
    'flower',
    'Λουλούδι',
    'Ποτίζουμε το λουλούδι. Τι το βοηθά;',
    'flower',
    'water',
    'glasses',
    'ball',
  ),
  scenario(
    'friend',
    'Φίλος',
    'Ο φίλος έριξε το παιχνίδι του. Τι μπορούμε να κάνουμε;',
    'friend',
    'hand',
    'hat',
    'bread',
    'LOGIC',
  ),
  scenario(
    'night',
    'Νύχτα',
    'Ήρθε η νύχτα. Τι βλέπουμε στον ουρανό;',
    'moon',
    'moon',
    'banana',
    'towel',
  ),
  scenario(
    'cloud',
    'Σύννεφο',
    'Ένα σύννεφο φέρνει βροχή. Τι πέφτει;',
    'cloud',
    'rain',
    'bread',
    'book',
  ),
  scenario('tree', 'Δέντρο', 'Ποιο μεγαλώνει από μικρό σπόρο;', 'seed', 'tree', 'cup', 'ball'),
  scenario(
    'shell',
    'Κοχύλι',
    'Τι μπορούμε να βρούμε στην παραλία;',
    'water',
    'shell',
    'lamp',
    'shoes',
    'CLASSIFICATION',
  ),
]
