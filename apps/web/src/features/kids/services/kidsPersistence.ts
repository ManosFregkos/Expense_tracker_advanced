import type {
  CompleteKidsSessionInput,
  PersistKidsAttemptInput,
  StartKidsSessionInput,
} from '@family-expense-tracker/shared'
import { api } from '../../../lib/callables'

type PendingWrite =
  | { key: string; kind: 'START'; payload: StartKidsSessionInput }
  | { key: string; kind: 'ATTEMPT'; payload: PersistKidsAttemptInput }
  | { key: string; kind: 'COMPLETE'; payload: CompleteKidsSessionInput }

const STORAGE_KEY = 'kids-card-engine-pending-v1'
let flushing = false

function readQueue(): PendingWrite[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? (value as PendingWrite[]) : []
  } catch {
    return []
  }
}

function saveQueue(queue: PendingWrite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-250)))
}

async function send(write: PendingWrite) {
  if (write.kind === 'START') await api.startKidsSession(write.payload)
  else if (write.kind === 'ATTEMPT') await api.persistKidsAttempt(write.payload)
  else await api.completeKidsSession(write.payload)
}

export async function flushKidsWrites() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    let queue = readQueue()
    while (queue.length && navigator.onLine) {
      try {
        await send(queue[0]!)
        queue = queue.slice(1)
        saveQueue(queue)
      } catch {
        break
      }
    }
  } finally {
    flushing = false
  }
}

function enqueue(write: PendingWrite) {
  const queue = readQueue()
  if (!queue.some((item) => item.key === write.key)) {
    queue.push(write)
    saveQueue(queue)
  }
  void flushKidsWrites()
}

export const kidsPersistence = {
  start(payload: StartKidsSessionInput) {
    enqueue({ key: `start:${payload.sessionId}`, kind: 'START', payload })
  },
  attempt(payload: PersistKidsAttemptInput) {
    enqueue({ key: `attempt:${payload.attemptId}`, kind: 'ATTEMPT', payload })
  },
  complete(payload: CompleteKidsSessionInput) {
    enqueue({ key: `complete:${payload.sessionId}`, kind: 'COMPLETE', payload })
  },
}

if (typeof window !== 'undefined') window.addEventListener('online', () => void flushKidsWrites())
