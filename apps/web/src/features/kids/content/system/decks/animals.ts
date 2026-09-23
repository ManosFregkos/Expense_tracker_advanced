import type { SystemDeckSeed } from '../types'

export const animals: SystemDeckSeed = {
  id: 'animals',
  title: 'Ζώα',
  description: 'Ζώα που γνωρίζουμε',
  category: 'ANIMAL',
  color: '#dff4e8',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT', 'COMPARE'],
  cards: [
    {
      id: 'elephant',
      title: 'ο ελέφαντας',
      symbol: '🐘',
      attributes: { size: 'LARGE', habitat: 'LAND' },
    },
    {
      id: 'giraffe',
      title: 'η καμηλοπάρδαλη',
      symbol: '🦒',
      attributes: { size: 'LARGE', habitat: 'LAND' },
    },
    { id: 'tiger', title: 'η τίγρη', symbol: '🐯', attributes: { size: 'LARGE', habitat: 'LAND' } },
    {
      id: 'mouse',
      title: 'το ποντίκι',
      symbol: '🐭',
      attributes: { size: 'SMALL', habitat: 'LAND' },
    },
    { id: 'cow', title: 'η αγελάδα', symbol: '🐄', attributes: { size: 'LARGE', habitat: 'FARM' } },
    {
      id: 'bee',
      title: 'η μέλισσα',
      symbol: '🐝',
      attributes: { size: 'SMALL', habitat: 'NATURE' },
    },
  ],
}
