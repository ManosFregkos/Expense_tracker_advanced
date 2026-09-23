import type { SystemDeckSeed } from '../types'

export const shapes: SystemDeckSeed = {
  id: 'shapes',
  title: 'Σχήματα',
  description: 'Απλά σχήματα',
  category: 'SHAPE',
  color: '#ede8ff',
  modes: ['LEARN_AND_CHOOSE', 'SAME_OR_DIFFERENT', 'ODD_ONE_OUT'],
  cards: [
    { id: 'circle', title: 'ο κύκλος', symbol: '●', attributes: { shape: 'CIRCLE' } },
    { id: 'square', title: 'το τετράγωνο', symbol: '■', attributes: { shape: 'SQUARE' } },
    { id: 'triangle', title: 'το τρίγωνο', symbol: '▲', attributes: { shape: 'TRIANGLE' } },
    {
      id: 'star-shape',
      title: 'το αστέρι με πέντε ακτίνες',
      symbol: '★',
      attributes: { shape: 'STAR', type: 'FIVE_POINTS' },
    },
    {
      id: 'detail-star',
      title: 'το αστέρι με έξι ακτίνες',
      symbol: '✦',
      attributes: { shape: 'STAR', type: 'SIX_POINTS' },
      difficulty: 4,
    },
    { id: 'heart-shape', title: 'η καρδιά', symbol: '♥', attributes: { shape: 'HEART' } },
    { id: 'diamond', title: 'ο ρόμβος', symbol: '◆', attributes: { shape: 'DIAMOND' } },
  ],
}
