import type { KidsCompareRelation } from '@family-expense-tracker/shared'

export interface SystemComparison {
  id: string
  relation: KidsCompareRelation
  deckId: string
  instruction: string
  options: readonly [
    { cardId: string; numericValue?: number; relationValue?: string },
    { cardId: string; numericValue?: number; relationValue?: string },
  ]
  correctCardId: string
}

export const SYSTEM_COMPARISONS: SystemComparison[] = [
  {
    id: 'bigger-animal',
    relation: 'BIGGER',
    deckId: 'animals',
    instruction: 'Ποιο είναι μεγαλύτερο;',
    options: [
      { cardId: 'elephant', numericValue: 10 },
      { cardId: 'mouse', numericValue: 1 },
    ],
    correctCardId: 'elephant',
  },
  {
    id: 'smaller-animal',
    relation: 'SMALLER',
    deckId: 'animals',
    instruction: 'Ποιο είναι μικρότερο;',
    options: [
      { cardId: 'elephant', numericValue: 10 },
      { cardId: 'mouse', numericValue: 1 },
    ],
    correctCardId: 'mouse',
  },
  {
    id: 'more-fruit',
    relation: 'MORE',
    deckId: 'fruits',
    instruction: 'Πού είναι περισσότερα;',
    options: [
      { cardId: 'grapes', numericValue: 6 },
      { cardId: 'apple', numericValue: 1 },
    ],
    correctCardId: 'grapes',
  },
  {
    id: 'less-fruit',
    relation: 'LESS',
    deckId: 'fruits',
    instruction: 'Πού είναι λιγότερα;',
    options: [
      { cardId: 'grapes', numericValue: 6 },
      { cardId: 'apple', numericValue: 1 },
    ],
    correctCardId: 'apple',
  },
  {
    id: 'taller-nature',
    relation: 'TALLER',
    deckId: 'nature',
    instruction: 'Ποιο είναι ψηλότερο;',
    options: [
      { cardId: 'tree', numericValue: 8 },
      { cardId: 'flower', numericValue: 2 },
    ],
    correctCardId: 'tree',
  },
  {
    id: 'shorter-nature',
    relation: 'SHORTER',
    deckId: 'nature',
    instruction: 'Ποιο είναι πιο κοντό;',
    options: [
      { cardId: 'tree', numericValue: 8 },
      { cardId: 'flower', numericValue: 2 },
    ],
    correctCardId: 'flower',
  },
  {
    id: 'full-glass',
    relation: 'FULL',
    deckId: 'household',
    instruction: 'Ποιο είναι γεμάτο;',
    options: [
      { cardId: 'full-glass', relationValue: 'FULL' },
      { cardId: 'empty-glass', relationValue: 'EMPTY' },
    ],
    correctCardId: 'full-glass',
  },
  {
    id: 'empty-glass',
    relation: 'EMPTY',
    deckId: 'household',
    instruction: 'Ποιο είναι άδειο;',
    options: [
      { cardId: 'full-glass', relationValue: 'FULL' },
      { cardId: 'empty-glass', relationValue: 'EMPTY' },
    ],
    correctCardId: 'empty-glass',
  },
  {
    id: 'inside-box',
    relation: 'INSIDE',
    deckId: 'household',
    instruction: 'Πού είναι η μπάλα μέσα στο κουτί;',
    options: [
      { cardId: 'inside-box', relationValue: 'INSIDE' },
      { cardId: 'outside-box', relationValue: 'OUTSIDE' },
    ],
    correctCardId: 'inside-box',
  },
  {
    id: 'outside-box',
    relation: 'OUTSIDE',
    deckId: 'household',
    instruction: 'Πού είναι η μπάλα έξω από το κουτί;',
    options: [
      { cardId: 'inside-box', relationValue: 'INSIDE' },
      { cardId: 'outside-box', relationValue: 'OUTSIDE' },
    ],
    correctCardId: 'outside-box',
  },
  {
    id: 'up-direction',
    relation: 'UP',
    deckId: 'household',
    instruction: 'Ποιο δείχνει επάνω;',
    options: [
      { cardId: 'arrow-up', relationValue: 'UP' },
      { cardId: 'arrow-down', relationValue: 'DOWN' },
    ],
    correctCardId: 'arrow-up',
  },
  {
    id: 'down-direction',
    relation: 'DOWN',
    deckId: 'household',
    instruction: 'Ποιο δείχνει κάτω;',
    options: [
      { cardId: 'arrow-up', relationValue: 'UP' },
      { cardId: 'arrow-down', relationValue: 'DOWN' },
    ],
    correctCardId: 'arrow-down',
  },
]
