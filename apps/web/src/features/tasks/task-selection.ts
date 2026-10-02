import { createContext } from 'react'

export interface TaskSelection {
  selectedIds: Set<string>
  busy: boolean
  onToggle(taskId: string): void
}

export const TaskSelectionContext = createContext<TaskSelection | undefined>(undefined)
