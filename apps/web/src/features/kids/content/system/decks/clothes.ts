import type { SystemDeckSeed } from '../types'

export const clothes: SystemDeckSeed = {
  id: 'clothes',
  title: 'Ρούχα',
  description: 'Ρούχα που φοράμε',
  category: 'CLOTHING',
  color: '#f3e9ff',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT', 'MATCHING'],
  cards: [
    { id: 'shoe', title: 'το παπούτσι', symbol: '👟' },
    { id: 'sock', title: 'η κάλτσα', symbol: '🧦' },
    { id: 'shirt', title: 'η μπλούζα', symbol: '👕' },
    { id: 'hat', title: 'το καπέλο', symbol: '🧢' },
    { id: 'trousers', title: 'το παντελόνι', symbol: '👖' },
    { id: 'coat', title: 'το παλτό', symbol: '🧥' },
  ],
}
