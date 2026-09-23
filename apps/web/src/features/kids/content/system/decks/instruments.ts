import type { SystemDeckSeed } from '../types'

export const instruments: SystemDeckSeed = {
  id: 'instruments',
  title: 'Μουσική',
  description: 'Μουσικά όργανα',
  category: 'MUSICAL_INSTRUMENT',
  color: '#ffe8ee',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT'],
  cards: [
    { id: 'guitar', title: 'η κιθάρα', symbol: '🎸' },
    { id: 'drum', title: 'το τύμπανο', symbol: '🥁' },
    { id: 'piano', title: 'το πιάνο', symbol: '🎹' },
    { id: 'violin', title: 'το βιολί', symbol: '🎻' },
    { id: 'trumpet', title: 'η τρομπέτα', symbol: '🎺' },
    { id: 'saxophone', title: 'το σαξόφωνο', symbol: '🎷' },
  ],
}
