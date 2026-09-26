import type { KidsCardGameMode } from '@family-expense-tracker/shared'

export const kidsStrings = {
  hubTitle: 'Τι θέλεις να κάνουμε;',
  learn: 'ΜΑΘΑΙΝΩ',
  observe: 'ΠΑΡΑΤΗΡΩ',
  think: 'ΣΚΕΦΤΟΜΑΙ',
  everyday: 'ΚΑΘΗΜΕΡΙΝΑ',
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
  EVERYDAY_CHOICE: 'Τι κάνουμε;',
  CLASSIFY: 'Πού ανήκει;',
  SEQUENCE: 'Τι έρχεται μετά;',
  EMOTION: 'Πώς νιώθει;',
  MEMORY_PAIRS: 'Βρες τα ζευγάρια',
  COUNT_FINGERS: 'Μετράω δάχτυλα',
  MATCH_FINGERS_TO_NUMBER: 'Αριθμός και δάχτυλα',
  COMPARE_QUANTITY: 'Περισσότερα ή λιγότερα',
  COUNT_OBJECTS: 'Μετράω αντικείμενα',
  MATCH_QUANTITY_TO_NUMBER: 'Αριθμός και ποσότητα',
  SIMPLE_SUM: 'Προσθέτω',
  LEARN_FLAG: 'Μαθαίνω σημαίες',
  FIND_FLAG: 'Βρες τη σημαία',
  MIXED_PLAY: 'Παίζουμε μαζί',
}
