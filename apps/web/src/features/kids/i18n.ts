import type { KidsCardGameMode } from '@family-expense-tracker/shared'

export const kidsStrings = {
  hubTitle: 'Τι θέλεις να κάνουμε;',
  learn: 'ΜΑΘΑΙΝΩ',
  observe: 'ΠΑΡΑΤΗΡΩ',
  think: 'ΣΚΕΦΤΟΜΑΙ',
  repeat: 'Άκουσε ξανά',
  tryAgain: 'Για κοίταξε άλλη μία φορά.',
  complete: 'Μπράβο! Παίξαμε μαζί!',
  again: 'ΠΑΛΙ',
  games: 'ΠΑΙΧΝΙΔΙΑ',
  same: 'ΙΔΙΑ',
  different: 'ΔΙΑΦΟΡΕΤΙΚΑ',
  continue: 'ΠΑΜΕ',
} as const

export const modeLabels: Record<KidsCardGameMode, string> = {
  LEARN_AND_CHOOSE: 'Βρες την κάρτα',
  SAME_OR_DIFFERENT: 'Ίδια ή διαφορετικά',
  MATCHING: 'Τι ταιριάζει;',
  ODD_ONE_OUT: 'Ποιο δεν ταιριάζει;',
  COMPARE: 'Σύγκρινε',
}
