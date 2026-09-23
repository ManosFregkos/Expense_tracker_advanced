import type { SystemDeckSeed } from '../types'

export const colors: SystemDeckSeed = {
  id: 'colors',
  title: 'Χρώματα',
  description: 'Καθαρά βασικά χρώματα',
  category: 'COLOR',
  color: '#f2ecff',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT'],
  cards: [
    { id: 'red', title: 'το κόκκινο', symbol: '🔴', attributes: { color: 'RED' } },
    { id: 'blue', title: 'το μπλε', symbol: '🔵', attributes: { color: 'BLUE' } },
    { id: 'yellow', title: 'το κίτρινο', symbol: '🟡', attributes: { color: 'YELLOW' } },
    { id: 'green', title: 'το πράσινο', symbol: '🟢', attributes: { color: 'GREEN' } },
    { id: 'orange-color', title: 'το πορτοκαλί', symbol: '🟠', attributes: { color: 'ORANGE' } },
    { id: 'purple', title: 'το μωβ', symbol: '🟣', attributes: { color: 'PURPLE' } },
  ],
}
