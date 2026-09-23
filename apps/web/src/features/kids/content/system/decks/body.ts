import type { SystemDeckSeed } from '../types'

export const body: SystemDeckSeed = {
  id: 'body',
  title: 'Το σώμα μου',
  description: 'Μέρη του σώματος',
  category: 'BODY_PART',
  color: '#ffede4',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT', 'MATCHING'],
  cards: [
    { id: 'eyes', title: 'τα μάτια', symbol: '👀' },
    { id: 'ear', title: 'το αυτί', symbol: '👂' },
    { id: 'nose', title: 'η μύτη', symbol: '👃' },
    { id: 'mouth', title: 'το στόμα', symbol: '👄' },
    { id: 'hand', title: 'το χέρι', symbol: '✋' },
    { id: 'foot', title: 'το πόδι', symbol: '🦶' },
    { id: 'teeth', title: 'τα δόντια', symbol: '🦷' },
  ],
}
