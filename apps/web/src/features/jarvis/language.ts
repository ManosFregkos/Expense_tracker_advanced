import type { JarvisTaskAction } from '@family-expense-tracker/shared'

export type JarvisLanguage = 'el-GR' | 'en-US'
const preferenceKey = 'jarvis-language'
export function readJarvisLanguage(): JarvisLanguage {
  try {
    return localStorage.getItem(preferenceKey) === 'en-US' ? 'en-US' : 'el-GR'
  } catch {
    return 'el-GR'
  }
}
export function saveJarvisLanguage(language: JarvisLanguage) {
  try {
    localStorage.setItem(preferenceKey, language)
  } catch {
    /* Session preference still works. */
  }
}
const english = {
  open: 'Open Jarvis assistant',
  close: 'Close Jarvis',
  title: 'Jarvis · Everyday assistant',
  greeting: 'Hello Sir',
  goodbye: 'Goodbye sir',
  wake: 'Hello Jarvis',
  stop: 'Jarvis stop',
  connecting: 'Connecting live voice',
  thinking: 'Thinking',
  speaking: 'Speaking',
  transcribing: 'Transcribing',
  off: 'Microphone off',
  listening: 'Listening to you',
  waiting: 'Waiting for Hello Jarvis',
  microphoneOff: 'Turn microphone off',
  enable: 'Enable microphone',
  start: 'Start live conversation',
  record: 'Record question',
  sendRecording: 'Send recording',
  playLive: 'Play live audio',
  play: 'Play answer',
  instructions:
    'Click Start live conversation to talk now, or Enable microphone once and allow access, then say “Hello Jarvis” to hear “Hello Sir”. Say “Jarvis stop” to hear “Goodbye sir”; Jarvis will wait for “Hello Jarvis” again.',
  notice:
    'AI-generated voice. Voice requires HTTPS, microphone permission, and this app in the foreground. Some TV browsers support text only. Closing this panel keeps listening enabled; use Turn microphone off to end listening.',
  privacy: 'Voice privacy',
  realtimePrivacy:
    'Live voice streams microphone audio to OpenAI, including nearby speech while waiting for the wake phrase. Requested household data is sent only through authorized app tools.',
  recognitionPrivacy:
    'Browser speech recognition may send audio to your browser’s speech service. Questions and requested household data are sent to OpenAI.',
  recordingPrivacy:
    'In hands-free mode, spoken audio—including wake phrases and nearby speech—is sent to OpenAI for transcription. Use Record question for one recording at a time.',
  firstClick: 'One click is needed before Jarvis can hear you',
  firstClickHelp:
    'Voice commands cannot turn on a disabled microphone. Enable it here first; listening continues when you close this panel while the app stays in the foreground.',
  language: 'Voice input language',
  english: 'English',
  greek: 'Greek',
  web: 'Use web search for current information',
  liveHelp:
    'Live voice · speak naturally, pause for an answer, and interrupt to ask a follow-up. Say “Jarvis stop” to return to wake listening. Task changes require confirmation below.',
  unavailable:
    'Microphone recording is unavailable in this browser. You can still type questions and play spoken answers.',
  log: 'Conversation with Jarvis',
  you: 'You',
  welcome: 'What can I help with, Sir?',
  examplesTitle: 'All command examples',
  examplesHelp:
    'Choose an example to put it in the question box. You can also ask naturally in your own words.',
  confirm: 'Confirm task change',
  cancel: 'Cancel task change',
  cancelled: 'Task change cancelled. Nothing was saved.',
  confirmHelp:
    'Dates and times use your household time zone. Nothing is saved until you confirm with the button.',
  expense: 'Expense ready for review',
  expenseHelp: 'Review the account and category, then Save to confirm.',
  review: 'Review expense',
  discard: 'Discard',
  audio: 'Latest Jarvis spoken answer',
  ask: 'Ask Jarvis',
  placeholder: 'Type a question or a voice command…',
  send: 'Send question',
  clear: 'Clear conversation',
  playbackError: 'Automatic playback is unavailable. Use the audio player or read the answer.',
  briefing: 'Morning briefing',
  briefingQuestion: 'Jarvis, give me my morning briefing',
  today: 'Today’s tasks',
  overdue: 'Overdue tasks',
  bills: 'Upcoming bill/admin tasks',
  billHelp:
    'Recorded tasks in Bills & Admin or Bills lists, not bank payment schedules or amounts.',
  spending: 'Monthly spending',
  missing: 'No data available',
  noTasks: 'No recorded tasks in this selection.',
  partial: 'Partial results; open Tasks for the full list.',
  household: 'Household',
  mine: 'Personal',
  through: 'Through',
  noBillList: 'No active bill list is configured.',
}
const greek: Record<keyof typeof english, string> = {
  open: 'Άνοιγμα βοηθού Τζάρβις',
  close: 'Κλείσιμο Τζάρβις',
  title: 'Τζάρβις · Καθημερινός βοηθός',
  greeting: 'Γεια σας, κύριε',
  goodbye: 'Αντίο, κύριε',
  wake: 'Γεια σου Τζάρβις',
  stop: 'Τζάρβις σταμάτα',
  connecting: 'Σύνδεση φωνητικής συνομιλίας',
  thinking: 'Σκέφτομαι',
  speaking: 'Μιλάω',
  transcribing: 'Μεταγραφή φωνής',
  off: 'Μικρόφωνο κλειστό',
  listening: 'Σας ακούω',
  waiting: 'Περιμένω το «Γεια σου Τζάρβις»',
  microphoneOff: 'Απενεργοποίηση μικροφώνου',
  enable: 'Ενεργοποίηση μικροφώνου',
  start: 'Έναρξη ζωντανής συνομιλίας',
  record: 'Ηχογράφηση ερώτησης',
  sendRecording: 'Αποστολή ηχογράφησης',
  playLive: 'Αναπαραγωγή ζωντανής φωνής',
  play: 'Ακούστε την απάντηση',
  instructions:
    'Πατήστε «Έναρξη ζωντανής συνομιλίας» για να μιλήσετε τώρα ή ενεργοποιήστε το μικρόφωνο και πείτε «Γεια σου Τζάρβις» για να ακούσετε «Γεια σας, κύριε». Πείτε «Τζάρβις σταμάτα» για να ακούσετε «Αντίο, κύριε». Μετά περιμένει ξανά την ενεργοποίηση.',
  notice:
    'Φωνή τεχνητής νοημοσύνης. Απαιτούνται HTTPS, άδεια μικροφώνου και η εφαρμογή στο προσκήνιο. Ορισμένοι περιηγητές τηλεόρασης υποστηρίζουν μόνο κείμενο. Το κλείσιμο του πάνελ διατηρεί την ακρόαση· για διακοπή απενεργοποιήστε το μικρόφωνο.',
  privacy: 'Απόρρητο φωνής',
  realtimePrivacy:
    'Ο ήχος του μικροφώνου μεταδίδεται στο OpenAI, μαζί με κοντινή ομιλία όσο περιμένει την ενεργοποίηση. Τα δεδομένα του νοικοκυριού αποστέλλονται μέσω των εξουσιοδοτημένων λειτουργιών της εφαρμογής.',
  recognitionPrivacy:
    'Η αναγνώριση φωνής μπορεί να στέλνει ήχο στην υπηρεσία του περιηγητή. Οι ερωτήσεις και τα ζητούμενα δεδομένα του νοικοκυριού αποστέλλονται στο OpenAI.',
  recordingPrivacy:
    'Στην αυτόματη ακρόαση, η ομιλία και οι φράσεις ενεργοποίησης αποστέλλονται στο OpenAI για μεταγραφή. Η «Ηχογράφηση ερώτησης» καταγράφει μία ερώτηση τη φορά.',
  firstClick: 'Χρειάζεται ένα πάτημα για να σας ακούσει ο Τζάρβις',
  firstClickHelp:
    'Μια φωνητική εντολή δεν μπορεί να ενεργοποιήσει κλειστό μικρόφωνο. Ενεργοποιήστε το πρώτα εδώ. Η ακρόαση συνεχίζεται με κλειστό πάνελ όσο η εφαρμογή μένει στο προσκήνιο.',
  language: 'Γλώσσα φωνής και απαντήσεων',
  english: 'Αγγλικά',
  greek: 'Ελληνικά',
  web: 'Αναζήτηση στο διαδίκτυο για πρόσφατες πληροφορίες',
  liveHelp:
    'Μιλήστε φυσικά και κάντε παύση για την απάντηση. Μπορείτε να διακόψετε με νέα ερώτηση. Πείτε «Τζάρβις σταμάτα» για επιστροφή στην αναμονή. Οι αλλαγές εργασιών χρειάζονται επιβεβαίωση παρακάτω.',
  unavailable:
    'Η ηχογράφηση δεν υποστηρίζεται σε αυτόν τον περιηγητή. Μπορείτε να γράφετε ερωτήσεις και να ακούτε τις απαντήσεις.',
  log: 'Συνομιλία με τον Τζάρβις',
  you: 'Εσείς',
  welcome: 'Πώς μπορώ να βοηθήσω, κύριε;',
  examplesTitle: 'Παραδείγματα όλων των εντολών',
  examplesHelp:
    'Επιλέξτε ένα παράδειγμα για να συμπληρωθεί η ερώτηση. Μπορείτε επίσης να μιλήσετε φυσικά, με δικά σας λόγια.',
  confirm: 'Επιβεβαίωση αλλαγής εργασίας',
  cancel: 'Ακύρωση αλλαγής εργασίας',
  cancelled: 'Η αλλαγή εργασίας ακυρώθηκε. Δεν αποθηκεύτηκε τίποτα.',
  confirmHelp:
    'Οι ημερομηνίες και ώρες ακολουθούν τη ζώνη ώρας του νοικοκυριού. Η αλλαγή αποθηκεύεται μόνο με το κουμπί επιβεβαίωσης.',
  expense: 'Το έξοδο είναι έτοιμο για έλεγχο',
  expenseHelp: 'Ελέγξτε τον λογαριασμό και την κατηγορία και αποθηκεύστε για επιβεβαίωση.',
  review: 'Έλεγχος εξόδου',
  discard: 'Απόρριψη',
  audio: 'Τελευταία φωνητική απάντηση Τζάρβις',
  ask: 'Ρωτήστε τον Τζάρβις',
  placeholder: 'Γράψτε μια ερώτηση ή φωνητική εντολή…',
  send: 'Αποστολή ερώτησης',
  clear: 'Καθαρισμός συνομιλίας',
  playbackError:
    'Η αυτόματη αναπαραγωγή δεν είναι διαθέσιμη. Χρησιμοποιήστε το πρόγραμμα αναπαραγωγής ή διαβάστε την απάντηση.',
  briefing: 'Πρωινή ενημέρωση',
  briefingQuestion: 'Τζάρβις, δώσε μου την πρωινή ενημέρωση',
  today: 'Σημερινές εργασίες',
  overdue: 'Εκπρόθεσμες εργασίες',
  bills: 'Προσεχείς λογαριασμοί και υποχρεώσεις',
  billHelp:
    'Καταγεγραμμένες εργασίες στις λίστες λογαριασμών, όχι τραπεζικές προθεσμίες ή ποσά πληρωμών.',
  spending: 'Έξοδα του μήνα',
  missing: 'Δεν υπάρχουν διαθέσιμα δεδομένα',
  noTasks: 'Δεν υπάρχουν καταγεγραμμένες εργασίες σε αυτή την επιλογή.',
  partial: 'Μερικά αποτελέσματα· ανοίξτε τις Εργασίες για ολόκληρη τη λίστα.',
  household: 'Νοικοκυριό',
  mine: 'Προσωπικά',
  through: 'Έως',
  noBillList: 'Δεν έχει οριστεί ενεργή λίστα λογαριασμών.',
}
export const jarvisCopy = (language: string) => (language === 'el-GR' ? greek : english)
export function jarvisExamples(language: string) {
  return language === 'el-GR'
    ? [
        'Γεια σου Τζάρβις',
        'Τζάρβις σταμάτα',
        'Τζάρβις, δώσε μου την πρωινή ενημέρωση',
        'Τι εργασίες έχω σήμερα;',
        'Ποιες εργασίες έχουν καθυστερήσει;',
        'Ποια είναι τα υπόλοιπα των λογαριασμών μου;',
        'Πόσα ξόδεψα αυτόν τον μήνα;',
        'Πόσα ξόδεψε το νοικοκυριό αυτόν τον μήνα;',
        'Βρες τις συναλλαγές στο Lidl από την 1η έως τη 10η Οκτωβρίου',
        'Δημιούργησε μια εργασία να αγοράσω γάλα αύριο',
        'Ολοκλήρωσε την εργασία για το γάλα',
        'Μετάφερε την εργασία για το γάλα στην Παρασκευή στις δέκα το πρωί',
        'Πρόσθεσε έξοδο 25 ευρώ για σούπερ μάρκετ',
        'Τι μπορώ να μαγειρέψω με αυγά και ρύζι;',
      ]
    : [
        'Hello Jarvis',
        'Jarvis stop',
        'Jarvis, give me my morning briefing',
        'What tasks are due today?',
        'What tasks are overdue?',
        'What are my account balances?',
        'How much did I spend this month?',
        'How much did our household spend this month?',
        'Find Lidl transactions from October 1 to October 10',
        'Create a task to buy milk tomorrow',
        'Complete the buy milk task',
        'Move the buy milk task to Friday at 10:00',
        'Add a €25 supermarket expense',
        'What can I cook with eggs and rice?',
      ]
}
export function taskConfirmation(
  language: string,
  action: JarvisTaskAction,
  nextTaskId: string | null = null,
) {
  const greek = language === 'el-GR'
  if (action.kind === 'create')
    return greek
      ? `Η εργασία δημιουργήθηκε: ${action.task.title}.`
      : `Task created: ${action.task.title}.`
  if (action.kind === 'complete')
    return greek
      ? `Η εργασία ολοκληρώθηκε: ${action.title}.${nextTaskId ? ' Δημιουργήθηκε η επόμενη επανάληψη.' : ''}`
      : `Task completed: ${action.title}.${nextTaskId ? ' The next recurring occurrence was created.' : ''}`
  return greek
    ? `Η εργασία μεταφέρθηκε: ${action.task.title}, ${action.task.dueDate ?? 'χωρίς προθεσμία'}${action.task.dueTime ? ` στις ${action.task.dueTime}` : ''}.`
    : `Task rescheduled: ${action.task.title}, ${action.task.dueDate ?? 'no due date'}${action.task.dueTime ? ` at ${action.task.dueTime}` : ''}.`
}
export function taskPreview(language: string, action: JarvisTaskAction) {
  const greek = language === 'el-GR'
  if (action.kind === 'complete')
    return greek
      ? `Ολοκλήρωση εργασίας.${action.recurring ? ' Μπορεί να δημιουργηθεί η επόμενη επανάληψη.' : ''}`
      : `Mark this task complete.${action.recurring ? ' Completing it may create the next recurring occurrence.' : ''}`
  const operation =
    action.kind === 'create'
      ? greek
        ? 'Δημιουργία εργασίας'
        : 'Create task'
      : `${greek ? 'Μεταφορά από' : 'Reschedule from'} ${action.previousDueDate ?? (greek ? 'χωρίς προθεσμία' : 'no due date')} ${action.previousDueTime ?? ''}`
  const schedule = `${action.task.dueDate ?? (greek ? 'Χωρίς προθεσμία' : 'No due date')} ${action.task.dueTime ?? ''}`
  const priorities = {
    NONE: 'Καμία',
    LOW: 'Χαμηλή',
    MEDIUM: 'Μέτρια',
    HIGH: 'Υψηλή',
    URGENT: 'Επείγουσα',
  }
  return `${operation} · ${schedule}${action.kind === 'create' ? (greek ? ` · Προτεραιότητα: ${priorities[action.task.priority]} · Ανάθεση: ${action.assigneeName ?? 'καμία'} · Λίστα: ${action.listName ?? 'καμία'}` : ` · Priority: ${action.task.priority} · Assignee: ${action.assigneeName ?? 'unassigned'} · List: ${action.listName ?? 'none'}`) : ''}`
}
