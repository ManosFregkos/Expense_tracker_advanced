import {
  assets,
  logicScenarios,
  memoryPool,
  worlds,
  type ExplorerMission,
  type ExplorerWorld,
  type LogicScenario,
} from './content'
export type GameType = 'EXPLORER' | 'MEMORY' | 'LOGIC'
export type Round =
  | {
      id: string
      gameType: 'MEMORY'
      contentId: string
      difficulty: number
      skill: 'MEMORY'
      narrationText: string
      narrationAudioUrl?: string
      visible: string[]
      missing: string
      choices: string[]
      observeMs: number
    }
  | {
      id: string
      gameType: 'EXPLORER'
      contentId: string
      difficulty: number
      skill: ExplorerMission['skill']
      narrationText: string
      narrationAudioUrl?: string
      world: ExplorerWorld
      targetId: string
    }
  | {
      id: string
      gameType: 'LOGIC'
      contentId: string
      difficulty: number
      skill: LogicScenario['skill']
      narrationText: string
      narrationAudioUrl?: string
      scenario: LogicScenario
      targetId: string
    }

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
export function generateMemoryRound(
  difficulty: number,
  random: () => number,
  index: number,
): Extract<Round, { gameType: 'MEMORY' }> {
  const level = Math.max(1, Math.min(4, difficulty))
  const count = [3, 4, 5, 6][level - 1]!
  const choiceCount = [2, 3, 3, 4][level - 1]!
  const visible = shuffle(memoryPool, random).slice(0, count)
  const missing = visible[Math.floor(random() * visible.length)]!
  const choices = shuffle(
    [
      missing,
      ...shuffle(
        memoryPool.filter((id) => !visible.includes(id)),
        random,
      ).slice(0, choiceCount - 1),
    ],
    random,
  )
  return {
    id: `memory-${index}`,
    gameType: 'MEMORY',
    contentId: `memory-${index}-${missing}`,
    difficulty: level,
    skill: 'MEMORY',
    narrationText: 'Τι λείπει;',
    visible,
    missing,
    choices,
    observeMs: level <= 2 ? 5000 : 4000,
  }
}
export function generateExplorerRounds(
  worldId: string,
  difficulty: number,
  count: number,
  random: () => number,
  recent: readonly string[] = [],
): Extract<Round, { gameType: 'EXPLORER' }>[] {
  const world = worlds.find((item) => item.id === worldId)
  if (!world) return []
  const pool = world.missions.filter(
    (mission) =>
      mission.difficulty <= Math.max(1, difficulty) &&
      world.objects.some((object) => object.id === mission.targetId),
  )
  const order = [
    ...shuffle(
      pool.filter((item) => !recent.includes(item.id)),
      random,
    ),
    ...shuffle(
      pool.filter((item) => recent.includes(item.id)),
      random,
    ),
  ]
  return order.slice(0, count).map((mission) => ({
    id: mission.id,
    gameType: 'EXPLORER',
    contentId: mission.id,
    difficulty: mission.difficulty,
    skill: mission.skill,
    narrationText: mission.narrationText,
    narrationAudioUrl: mission.narrationAudioUrl,
    world,
    targetId: mission.targetId,
  }))
}
export function generateLogicRounds(
  difficulty: number,
  count: number,
  random: () => number,
  custom: LogicScenario[] = [],
  recent: readonly string[] = [],
): Extract<Round, { gameType: 'LOGIC' }>[] {
  const valid = (item: LogicScenario) =>
    item.enabled !== false &&
    item.difficulty <= Math.max(1, difficulty) &&
    !!assets[item.illustrationAssetId] &&
    item.options.length >= 2 &&
    item.options.length <= 3 &&
    item.options.filter((option) => option.isPreferredAnswer).length === 1 &&
    item.options.every((option) => !!assets[option.assetId]) &&
    new Set(item.options.map((option) => option.assetId)).size === item.options.length
  const customValid = shuffle(custom.filter(valid), random)
  const systemValid = shuffle(logicScenarios.filter(valid), random)
  const unique = [
    ...customValid,
    ...systemValid.filter((item) => !customValid.some((customItem) => customItem.id === item.id)),
  ]
  const selected = [
    ...unique.filter((item) => !recent.includes(item.id)),
    ...unique.filter((item) => recent.includes(item.id)),
  ].slice(0, count)
  return selected.map((scenario, index) => {
    const options =
      difficulty <= 1 && scenario.options.length > 2
        ? shuffle(
            [
              scenario.options.find((option) => option.isPreferredAnswer)!,
              shuffle(
                scenario.options.filter((option) => !option.isPreferredAnswer),
                random,
              )[0]!,
            ],
            random,
          )
        : shuffle(scenario.options, random)
    return {
      id: `logic-${index}-${scenario.id}`,
      gameType: 'LOGIC' as const,
      contentId: scenario.id,
      difficulty: Math.max(1, Math.min(3, difficulty)),
      skill: scenario.skill,
      narrationText: scenario.narrationText,
      narrationAudioUrl: scenario.narrationAudioUrl,
      scenario: { ...scenario, options },
      targetId: scenario.options.find((option) => option.isPreferredAnswer)!.id,
    }
  })
}
