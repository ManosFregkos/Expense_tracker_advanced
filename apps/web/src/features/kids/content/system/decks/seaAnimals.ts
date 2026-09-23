import type { SystemDeckSeed } from '../types'

export const seaAnimals: SystemDeckSeed = {
  id: 'sea-animals',
  title: 'Ζώα της θάλασσας',
  description: 'Φίλοι του νερού',
  category: 'SEA_ANIMAL',
  color: '#dff3ff',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT', 'MATCHING'],
  cards: [
    { id: 'fish', title: 'το ψάρι', symbol: '🐟', attributes: { habitat: 'WATER' } },
    { id: 'octopus', title: 'το χταπόδι', symbol: '🐙', attributes: { habitat: 'WATER' } },
    { id: 'dolphin', title: 'το δελφίνι', symbol: '🐬', attributes: { habitat: 'WATER' } },
    {
      id: 'whale',
      title: 'η φάλαινα',
      symbol: '🐋',
      attributes: { habitat: 'WATER', size: 'LARGE' },
    },
    { id: 'crab', title: 'το καβούρι', symbol: '🦀', attributes: { habitat: 'WATER' } },
    { id: 'turtle', title: 'η χελώνα', symbol: '🐢', attributes: { habitat: 'WATER' } },
  ],
}
