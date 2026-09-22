import type { GameType, Round } from './engine'

export interface PlayState {
  sessionId: string
  childProfileId: string
  gameType: GameType
  worldId?: string
  rounds: Round[]
  index: number
  phase: 'observe' | 'hide' | 'answer' | 'correct' | 'complete'
  attempts: number
}
