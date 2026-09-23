import type { SystemDeckSeed } from '../types'

export const space: SystemDeckSeed = {
  id: 'space',
  title: 'Διάστημα',
  description: 'Ο ουρανός και το διάστημα',
  category: 'SPACE',
  color: '#e5e7ff',
  modes: ['LEARN_AND_CHOOSE', 'ODD_ONE_OUT', 'SAME_OR_DIFFERENT'],
  cards: [
    { id: 'planet', title: 'ο πλανήτης', symbol: '🪐' },
    { id: 'rocket', title: 'ο πύραυλος', symbol: '🚀' },
    { id: 'moon', title: 'το φεγγάρι', symbol: '🌙' },
    { id: 'star', title: 'το αστέρι', symbol: '⭐' },
    { id: 'comet', title: 'ο κομήτης', symbol: '☄️' },
    { id: 'astronaut', title: 'ο αστροναύτης', symbol: '🧑‍🚀' },
  ],
}
