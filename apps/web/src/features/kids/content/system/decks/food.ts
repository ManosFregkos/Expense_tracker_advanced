import type { SystemDeckSeed } from '../types'

export const food: SystemDeckSeed = {
  id: 'food',
  title: 'Φαγητά',
  description: 'Γνώριμα φαγητά',
  category: 'FOOD',
  color: '#fff4cf',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT', 'MATCHING'],
  cards: [
    { id: 'bread', title: 'το ψωμί', symbol: '🍞' },
    { id: 'cheese', title: 'το τυρί', symbol: '🧀' },
    { id: 'egg', title: 'το αυγό', symbol: '🥚' },
    { id: 'milk', title: 'το γάλα', symbol: '🥛' },
    { id: 'honey', title: 'το μέλι', symbol: '🍯' },
    { id: 'soup', title: 'η σούπα', symbol: '🍲' },
  ],
}
