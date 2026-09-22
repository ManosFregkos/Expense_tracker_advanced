import { collection, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, firestore, functions } from '../../lib/firebase'
import { FirebaseError } from 'firebase/app'
import {
  customLogicSchema,
  type ChildProfile,
  type ChildProfileInput,
  type CustomLogicInput,
  type KidsGameProgress,
} from '@family-expense-tracker/shared'
import { assets, type LogicScenario } from './content'
import type { GameType } from './engine'

const collectionPath = (householdId: string, name: string) =>
  collection(firestore, `households/${householdId}/${name}`)
export async function listChildren(householdId: string): Promise<ChildProfile[]> {
  const result = await getDocs(collectionPath(householdId, 'childProfiles'))
  return result.docs
    .map((item) => item.data() as ChildProfile)
    .filter((item) => !item.archivedAt && item.householdId === householdId)
}
export type KidsProgress = Partial<KidsGameProgress> &
  Pick<KidsGameProgress, 'childProfileId' | 'gameType' | 'currentDifficulty'>
export async function listProgress(householdId: string): Promise<KidsProgress[]> {
  const result = await getDocs(collectionPath(householdId, 'kidsProgress'))
  return result.docs
    .map((item) => item.data() as KidsProgress)
    .filter((item) => item.childProfileId)
}
export async function listCustomLogic(householdId: string): Promise<LogicScenario[]> {
  const result = await getDocs(collectionPath(householdId, 'kidsCustomContent'))
  return result.docs.flatMap((item) => {
    const data = item.data()
    if (data.householdId !== householdId || data.enabled !== true || data.archivedAt) return []
    const parsed = customLogicSchema.safeParse(data)
    if (
      !parsed.success ||
      !assets[parsed.data.illustrationAssetId] ||
      parsed.data.options.some((option) => !assets[option.assetId])
    )
      return []
    return [
      {
        ...parsed.data,
        id: item.id,
        skill: parsed.data.skill as LogicScenario['skill'],
        enabled: true,
      } as LogicScenario,
    ]
  })
}
async function call<Input, Output>(name: string, input: Input): Promise<Output> {
  return (await httpsCallable<Input, Output>(functions, name)(input)).data
}
export const saveChildProfile = (input: ChildProfileInput) =>
  call<ChildProfileInput, { childProfileId: string }>('saveChildProfile', input)
export const saveCustomLogic = (input: CustomLogicInput) =>
  call<CustomLogicInput, { contentId: string }>('saveKidsCustomContent', input)
export const archiveCustomLogic = (input: { householdId: string; contentId: string }) =>
  call<typeof input, { contentId: string }>('archiveKidsCustomContent', input)
export type KidsWrite =
  | {
      name: 'startKidsSession'
      input: {
        householdId: string
        childProfileId: string
        sessionId: string
        gameType: GameType
        worldId?: 'underwater' | 'jungle' | 'space'
      }
    }
  | {
      name: 'completeKidsRound'
      input: {
        householdId: string
        childProfileId: string
        sessionId: string
        roundId: string
        contentId: string
        skill: string
        difficulty: number
        isCorrect: boolean
        attemptCount: number
      }
    }
  | {
      name: 'completeKidsSession'
      input: { householdId: string; childProfileId: string; sessionId: string }
    }
const queueKey = () => `kids-writes-${auth.currentUser?.uid ?? 'signed-out'}`
let flushPromise: Promise<void> | null = null
export function enqueueKidsWrite(write: KidsWrite) {
  const key = queueKey()
  const queue = readQueue(key)
  if (
    !queue.some(
      (item) =>
        item.name === write.name &&
        item.input.sessionId === write.input.sessionId &&
        ('roundId' in item.input ? item.input.roundId : '') ===
          ('roundId' in write.input ? write.input.roundId : ''),
    )
  )
    queue.push(write)
  localStorage.setItem(key, JSON.stringify(queue))
  void flushKidsWrites()
}
function readQueue(key: string): KidsWrite[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? (value as KidsWrite[]) : []
  } catch {
    return []
  }
}
function writeId(item: KidsWrite) {
  return `${item.name}:${item.input.sessionId}:${'roundId' in item.input ? item.input.roundId : ''}`
}
export async function flushKidsWrites() {
  if (flushPromise) return flushPromise
  if (!navigator.onLine || !auth.currentUser) return
  const userId = auth.currentUser.uid
  const key = queueKey()
  flushPromise = (async () => {
    while (true) {
      if (auth.currentUser?.uid !== userId) break
      const queue = readQueue(key)
      const item = queue[0]
      if (!item) break
      let permanentFailure = false
      try {
        await call(item.name, item.input)
      } catch (error) {
        if (
          !(error instanceof FirebaseError) ||
          ![
            'functions/permission-denied',
            'functions/invalid-argument',
            'functions/failed-precondition',
            'functions/not-found',
          ].includes(error.code)
        )
          break
        permanentFailure = true
      }
      const latest = readQueue(key)
      const filtered = permanentFailure
        ? latest.filter((entry) => entry.input.sessionId !== item.input.sessionId)
        : latest.filter((entry) => writeId(entry) !== writeId(item))
      localStorage.setItem(key, JSON.stringify(filtered))
    }
  })()
  try {
    await flushPromise
  } finally {
    flushPromise = null
  }
}
