import type { SystemDeckSeed } from '../types'

export const nature: SystemDeckSeed = {
  id: 'nature',
  title: 'Φύση',
  description: 'Όμορφα πράγματα στη φύση',
  category: 'NATURE',
  color: '#e3f6df',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT', 'COMPARE'],
  cards: [
    { id: 'tree', title: 'το δέντρο', symbol: '🌳', attributes: { size: 'TALL' } },
    { id: 'flower', title: 'το λουλούδι', symbol: '🌼', attributes: { size: 'SHORT' } },
    { id: 'sun', title: 'ο ήλιος', symbol: '☀️', attributes: { location: 'UP' } },
    { id: 'mountain', title: 'το βουνό', symbol: '⛰️' },
    { id: 'leaf', title: 'το φύλλο', symbol: '🍃' },
    { id: 'rain', title: 'η βροχή', symbol: '🌧️' },
    { id: 'water', title: 'το νερό', symbol: '💧', attributes: { habitat: 'WATER' } },
  ],
}
