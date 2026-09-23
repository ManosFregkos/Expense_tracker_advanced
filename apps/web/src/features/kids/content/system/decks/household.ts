import type { SystemDeckSeed } from '../types'

export const household: SystemDeckSeed = {
  id: 'household',
  title: 'Στο σπίτι',
  description: 'Αντικείμενα του σπιτιού',
  category: 'HOUSE_OBJECT',
  color: '#e7f3ef',
  modes: ['LEARN_AND_CHOOSE', 'MATCHING', 'SAME_OR_DIFFERENT', 'COMPARE'],
  cards: [
    { id: 'umbrella', title: 'η ομπρέλα', symbol: '☂️' },
    { id: 'toothbrush', title: 'η οδοντόβουρτσα', symbol: '🪥' },
    { id: 'key', title: 'το κλειδί', symbol: '🔑' },
    { id: 'bed', title: 'το κρεβάτι', symbol: '🛏️' },
    { id: 'spoon', title: 'το κουτάλι', symbol: '🥄' },
    { id: 'bowl', title: 'το μπολ', symbol: '🥣' },
    { id: 'full-glass', title: 'το γεμάτο ποτήρι', symbol: '🥛', attributes: { type: 'FULL' } },
    { id: 'empty-glass', title: 'το άδειο ποτήρι', symbol: '🥃', attributes: { type: 'EMPTY' } },
    { id: 'inside-box', title: 'η μπάλα μέσα', symbol: '📦⚽', attributes: { location: 'INSIDE' } },
    {
      id: 'outside-box',
      title: 'η μπάλα έξω',
      symbol: '⚽  📦',
      attributes: { location: 'OUTSIDE' },
    },
    { id: 'arrow-up', title: 'επάνω', symbol: '⬆️', attributes: { location: 'UP' } },
    { id: 'arrow-down', title: 'κάτω', symbol: '⬇️', attributes: { location: 'DOWN' } },
  ],
}
