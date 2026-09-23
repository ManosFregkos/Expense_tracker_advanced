import type { SystemDeckSeed } from '../types'

export const fruits: SystemDeckSeed = {
  id: 'fruits',
  title: 'Φρούτα',
  description: 'Χρώματα και γεύσεις',
  category: 'FRUIT',
  color: '#fff0dc',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT', 'COMPARE'],
  cards: [
    { id: 'apple', title: 'το μήλο', symbol: '🍎', attributes: { color: 'RED', count: 1 } },
    { id: 'banana', title: 'η μπανάνα', symbol: '🍌', attributes: { color: 'YELLOW', count: 1 } },
    { id: 'pear', title: 'το αχλάδι', symbol: '🍐', attributes: { color: 'GREEN', count: 1 } },
    {
      id: 'orange',
      title: 'το πορτοκάλι',
      symbol: '🍊',
      attributes: { color: 'ORANGE', count: 1 },
    },
    { id: 'grapes', title: 'τα σταφύλια', symbol: '🍇', attributes: { color: 'PURPLE', count: 6 } },
    { id: 'strawberry', title: 'η φράουλα', symbol: '🍓', attributes: { color: 'RED', count: 1 } },
  ],
}
