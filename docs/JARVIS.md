# Jarvis voice assistant

Jarvis is available from the signed-in app header. **Greek is the default** for
voice input, replies, greetings and panel controls. Click **Έναρξη ζωντανής
συνομιλίας** to talk immediately, or **Ενεργοποίηση μικροφώνου** once and allow
microphone access, then say **Γεια σου Τζάρβις** or **Καλημέρα Τζάρβις** to wake it.
The immediate greeting is **Γεια σας, κύριε**. Say **Τζάρβις σταμάτα** or
**Σταμάτα Τζάρβις** to hear **Αντίο, κύριε** and return to wake listening.
**Απενεργοποίηση μικροφώνου** releases the microphone completely.

English remains selectable, with **Hello Jarvis**, **Hello Sir**, **Jarvis stop**
and **Goodbye sir**. Literal English wake/stop commands use these English greetings
even with Greek selected for questions and replies. English wake/stop phrases and
their Greek transcriptions remain recognized in either language. Supported browsers use OpenAI Realtime over
WebRTC for streaming audio, captions, follow-up questions and interruptions. Live
speech uses Cedar; typed/manual answers use the existing Onyx endpoint.

The conversation is in memory and clears on sign-out, reload, household change, or
**Clear conversation**. Backgrounding the page stops audio and listening; enable it
again when returning. Closing the Jarvis panel keeps foreground listening enabled,
with a filled Jarvis indicator in the header.

## Server configuration

Use a billed OpenAI API project with access to the configured models. Keep the API
key in Firebase Secret Manager, never in Vite variables or browser code:

```sh
firebase functions:secrets:set OPENAI_API_KEY --project <your-project>
npm run build
firebase deploy --only functions:jarvisChat,functions:jarvisTranscribe,functions:jarvisSpeak,functions:jarvisStartRealtime,functions:completeTask --project <your-project>
firebase deploy --only hosting --project <your-project>
```

For emulator development, put `OPENAI_API_KEY=...` in the untracked
`functions/.secret.local`, then restart Functions emulators. Do not commit this file.

The default model IDs are `gpt-4.1-mini`, `gpt-4o-mini-transcribe`, and
`gpt-4o-mini-tts`; the example IDs `gpt-5o-mini` and `gpt-5o-mini-tts` are not used.
Models can be configured through Firebase parameter environment files:

```dotenv
JARVIS_CHAT_MODEL=gpt-4.1-mini
JARVIS_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
JARVIS_SPEECH_MODEL=gpt-4o-mini-tts
JARVIS_REALTIME_MODEL=gpt-realtime-2.1-mini
```

Place production overrides in `functions/.env.expense-tracker-v2-9520e`, preserving
other settings; do not put them in `apps/web/.env.production`. The Realtime model
must support the GA Realtime API, low reasoning, server VAD, function calling and
the `cedar` voice. The selected transcription model must support Realtime input
transcription as well as `/audio/transcriptions` (for example `gpt-transcribe`).
The server authenticates the member, configures the session and exchanges the SDP
offer through `/realtime/calls`; only the SDP answer is returned to the browser.
No permanent or ephemeral OpenAI key is exposed. The browser receives captions
and delegates app requests to the same authenticated `jarvisChat` callable.

Use compatible replacements as models are retired. The chat model must support the
Responses API, function tools, and web search when enabled. The speech endpoint
must support the `onyx` voice and MP3 output. Redeploy Functions after changing
configuration or the secret. No new npm packages are required.

## Capabilities and confirmed changes

- Everyday questions, recipes, explanations, learning, and planning; responses
  use the selected language unless the user explicitly requests another. Greek is
  the default; English remains available.
- Optional web search for live information with clickable source links; off by
  default. Household financial information must not be included in search queries.
- “How much did I spend this month?” reads the signed-in member's expenses, based
  on the owner of the paying account. Household spending and income are also
  available by calendar month. Personal income and arbitrary filters are not
  supported; Jarvis distinguishes these scopes explicitly.
- “Add a €25 supermarket expense” prepares an expense draft. Click **Review
  expense**, check the amount/date, choose an account and category, and press
  **Save expense**. An unspecified account is left empty. Existing transaction
  validation, balance updates, analytics, and audit logging handle the save.
- “Find Lidl transactions between October 1 and October 10” searches individual
  transactions by merchant/description and inclusive dates in the household time
  zone. “My transactions” filters by the signed-in account owner. Returns up to
  20 results after scanning at most 300 matching records; partial results are
  flagged. Narrow the dates/search when truncated. These lists are not total
  spending calculations.
- “What are my account balances?” reads active accounts owned by the signed-in
  member; “our household balances” includes all active household accounts. App
  balances and bank-reported balances are labeled separately with update times.
  Currencies stay separate; these are stored app values, not a fresh bank sync.
- “What tasks are due today?” and “What is overdue?” use the household time zone
  and exclude completed, cancelled and deleted tasks. “My tasks” means tasks
  assigned to the signed-in member. Open task title/description search is also
  available. Returns up to 30 tasks from at most 200 open records, with a flag
  when results are partial. Task-list and member options resolve assignment IDs.
- “Create a task to buy milk tomorrow”, “Complete the buy milk task”, and
  “Move the buy milk task to Friday at 10:00” prepare one task change for review.
  The card shows the title and proposed schedule, or completion and recurrence
  implications. Creation also shows priority, assignee and list. Press **Confirm
  task change** to save, or **Cancel task change** to discard. Spoken “yes” does
  not save. New tasks have no reminder or recurrence; configure those in Tasks.
- Both typed and live voice app questions use the same authorized tools. Task
  confirmations use existing task APIs, preserving audit records, assignment
  notifications and recurring-task behavior. Creation retries reuse a request ID;
  rescheduling/completion check the preview version. A stale preview requires a
  fresh request. Completion retries do not create duplicate recurring occurrences.
  Successful changes refresh the Tasks UI and add the real result to voice
  context. Failed saves keep the preview available for retry.
- AI tools cannot write. Only an explicit confirmation button or the expense
  review form invokes a write. Deleting tasks/transactions, arbitrary task edits,
  booking and sending messages are unsupported. New questions, interruptions,
  stop commands or turning the microphone off discard pending task previews.

No new Firestore indexes or packages are needed; queries reuse existing task and
transaction indexes. Deploy **completeTask** with the Jarvis endpoints and Hosting
so confirmed completions enforce their preview version. Do not deploy just Hosting.

## Πρωινή ενημέρωση και ελληνικές εντολές

Τα **Ελληνικά** είναι πλέον η προεπιλογή για φωνή, απαντήσεις και το πάνελ του
Τζάρβις. Η επιλογή γλώσσας διατηρείται στη συσκευή· μόνο αυτή η προτίμηση
αποθηκεύεται τοπικά, όχι το ιστορικό συνομιλίας. Τα Αγγλικά παραμένουν διαθέσιμα.
Στα ελληνικά η ενεργοποίηση απαντά **«Γεια σας, κύριε»** και η διακοπή
**«Αντίο, κύριε»**. Η διακοπή επιστρέφει στην αναμονή ενεργοποίησης.

| Λειτουργία            | Παράδειγμα ελληνικής εντολής                                        |
| --------------------- | ------------------------------------------------------------------- |
| Ενεργοποίηση          | «Γεια σου Τζάρβις» ή «Καλημέρα Τζάρβις»                             |
| Διακοπή               | «Τζάρβις σταμάτα» ή «Σταμάτα Τζάρβις»                               |
| Πρωινή ενημέρωση      | «Τζάρβις, δώσε μου την πρωινή ενημέρωση»                            |
| Σημερινές εργασίες    | «Τι εργασίες έχω σήμερα;»                                           |
| Εκπρόθεσμες εργασίες  | «Ποιες εργασίες έχουν καθυστερήσει;»                                |
| Υπόλοιπα λογαριασμών  | «Ποια είναι τα υπόλοιπα των λογαριασμών μου;»                       |
| Προσωπικά έξοδα       | «Πόσα ξόδεψα αυτόν τον μήνα;»                                       |
| Έξοδα νοικοκυριού     | «Πόσα ξόδεψε το νοικοκυριό αυτόν τον μήνα;»                         |
| Αναζήτηση συναλλαγών  | «Βρες τις συναλλαγές στο Lidl από την 1η έως τη 10η Οκτωβρίου»      |
| Δημιουργία εργασίας   | «Δημιούργησε μια εργασία να αγοράσω γάλα αύριο»                     |
| Ολοκλήρωση εργασίας   | «Ολοκλήρωσε την εργασία για το γάλα»                                |
| Μεταφορά εργασίας     | «Μετάφερε την εργασία για το γάλα στην Παρασκευή στις δέκα το πρωί» |
| Νέο έξοδο             | «Πρόσθεσε έξοδο 25 ευρώ για σούπερ μάρκετ»                          |
| Καθημερινές ερωτήσεις | «Τι μπορώ να μαγειρέψω με αυγά και ρύζι;»                           |

Αυτά είναι παραδείγματα, όχι υποχρεωτικές ακριβείς φράσεις για τις ερωτήσεις.
Το πάνελ περιλαμβάνει όλα τα παραδείγματα· επιλέγοντας ένα συμπληρώνεται το πεδίο
ερώτησης χωρίς να εκτελείται αυτόματα. Οι φράσεις ενεργοποίησης/διακοπής
αναγνωρίζονται με παραλλαγές γραφής και τόνων. Η φράση ενεργοποίησης δέχεται
ερώτηση στην ίδια πρόταση. Χρειάζεται πρώτα πάτημα και άδεια μικροφώνου.

Η πρωινή ενημέρωση λειτουργεί με φωνή, κείμενο ή το κουμπί **Πρωινή ενημέρωση**.
Το εργαλείο `get_morning_briefing` συλλέγει, μόνο για το εξουσιοδοτημένο νοικοκυριό:

- Σημερινές και εκπρόθεσμες ανοικτές εργασίες, με βάση τη ζώνη ώρας του νοικοκυριού.
- Μη εκπρόθεσμες υποχρεώσεις έως την ημερομηνία επτά ημέρες μετά τη σημερινή,
  από την ενεργή λίστα **Bills & Admin**, **Bills** ή **Λογαριασμοί** / **Λογαριασμοί και υποχρεώσεις**.
- Συνολικά έξοδα του τρέχοντος μήνα από τα υπάρχοντα μηνιαία στοιχεία.

Η προεπιλεγμένη ενημέρωση αφορά το νοικοκυριό. Η φράση «δώσε μου» δεν αλλάζει το
οικονομικό πεδίο σε προσωπικό. Για προσωπική ενημέρωση πείτε ρητά
«Δώσε μου ενημέρωση για τις δικές μου εργασίες και τα δικά μου έξοδα αυτόν τον μήνα»
μαζί με «πρωινή ενημέρωση». Στην προσωπική επιλογή, εργασίες/υποχρεώσεις σημαίνουν
όσες έχουν ανατεθεί στον συνδεδεμένο χρήστη και έξοδα όσα πλήρωσε ο ίδιος.

Η απάντηση είναι μία σύντομη φωνητική σύνοψη τεσσάρων έως έξι προτάσεων, μαζί
με κάρτα δεδομένων και συνδέσμους προς τις εργασίες. Δεν πραγματοποιεί αλλαγές.
Οι λογαριασμοί είναι καταγεγραμμένες εργασίες, όχι νέες τραπεζικές πληροφορίες,
ποσά πληρωμών ή επιβεβαιώσεις εξόφλησης. Αν λείπει λίστα λογαριασμών ή μηνιαία
στοιχεία, αναφέρεται η έλλειψη. Τα μερικά αποτελέσματα επισημαίνονται.
Οι επαναλαμβανόμενες εργασίες περιλαμβάνουν μόνο τις ήδη δημιουργημένες εμφανίσεις.

Οι αλλαγές εργασιών χρειάζονται **Επιβεβαίωση αλλαγής εργασίας**.
Η **Ακύρωση αλλαγής εργασίας** δεν αποθηκεύει τίποτα. Ένα προφορικό «ναι»
δεν αποθηκεύει αλλαγές. Τα έξοδα χρειάζονται έλεγχο στην υπάρχουσα φόρμα συναλλαγών.
Δεν προστέθηκε αυτόματη προγραμματισμένη αποστολή της ενημέρωσης.

Οι ίδιες τέσσερις λειτουργίες Jarvis και το Hosting χρειάζονται νέα ανάπτυξη.
Δεν χρειάζονται νέα ευρετήρια Firestore ή πακέτα. Τα μοντέλα και τα κλειδιά
παραμένουν στην υπάρχουσα διαμόρφωση του Functions.

All four callable functions require a verified signed-in user and household
membership. Document IDs and tool arguments are validated on the server. OpenAI
requests use `store: false`; no transcript is stored in Firestore. A private
server-only usage counter allows 30 AI endpoint calls per minute and 1,000 per UTC
day per user, shared across all four endpoints. This includes fallback transcription
while waiting for a wake phrase and Realtime connection creation. Streaming voice
is billed separately by the provider; endpoint request counts do not cap Realtime
audio usage. These limits do not replace provider billing controls.

## Browser behavior and privacy

Serve the app over HTTPS (localhost works for development). Browser security
requires a first click and microphone permission: wake listening cannot start
automatically on first page load.

Where browser SpeechRecognition is available, enabling the microphone starts that
foreground wake listener without opening an OpenAI connection. **Hello Jarvis** or
the Greek wake phrase opens the panel, speaks the greeting and starts Realtime
automatically. **Jarvis stop** cancels the answer, closes live media and resumes
the browser wake listener, so another wake phrase starts a fresh live conversation.
No second Live button click is required. The wake listener stays available until
the live data channel opens. A first question received during connection waits up
to three seconds for live voice, then uses continuous voice chat if needed.

Without browser recognition, WebRTC also handles wake transcription and sends
ambient speech to OpenAI while waiting. Server VAD has automatic responses disabled;
the app creates responses only after activation. Wake/stop and ignored speech
items are removed from the session conversation. A failed/disconnected live session
falls back to continuous browser recognition or recording/transcription. Browser
speech-service failure also falls back to recording when supported; microphone
permission denial stops listening without repeated permission requests.
Closing the panel keeps foreground listening enabled. Turning the microphone off, signing out,
changing household, or leaving the app foreground closes WebRTC, stops all
microphone tracks and discards pending lookups/replies. A failed live connection
displays a fallback message and resumes continuous voice input when available;
Record question and text remain available.
Some networks block WebRTC; test on the actual production networks/devices.

On browsers without WebRTC, browser SpeechRecognition handles wake commands and questions.
That service may send audio to the browser vendor. On browsers without it, the
MediaRecorder/Web Audio fallback detects speech and sends complete utterances to
OpenAI transcription, including nearby speech while waiting for the wake phrase.
Silent segments are discarded. The privacy notice appears before enabling it.

**Record question** captures one question, up to 20 seconds; **Send recording**
submits it early. This option works even if browser speech recognition fails.
During playback, both voice engines accept the stop phrase while suppressing
ordinary speech to prevent echo from becoming a new question. Cloud transcription
can include speaker audio and adds latency; the visible **Jarvis stop** button
interrupts immediately. Headphones improve wake detection and acoustic isolation.

The shared worker is registered from `/sw.js` with `updateViaCache: none`. A
JavaScript compatibility worker exists at `/firebase-messaging-sw.js` for older
registrations. Worker scripts are not cached, navigation HTML is revalidated, and
missing script URLs return 404 instead of SPA HTML. Existing controlled tabs reload
once on worker update to avoid requesting removed lazy chunks from an old build.

Safari/iPhone and Android support depends on permissions and available browser
APIs; continuous browser recognition may end or need restarting. Smart TV browsers
often expose neither microphone recording nor speech recognition. Those devices
retain text chat and audio playback where supported; no web app can enable a
microphone API the TV does not provide. TV remote voice search is not automatically
exposed to web pages. Mobile autoplay may require tapping **Play answer** or the
audio controls. Playback falls back to browser speech synthesis if AI speech fails.

## Validation

```sh
npm run typecheck
npm run lint
npm run test --workspace=@family-expense-tracker/shared
npm run test --workspace=@family-expense-tracker/functions
npm run test --workspace=@family-expense-tracker/web -- --maxWorkers=2 --testTimeout=120000
npm run build
npm run test:e2e
```

Tests mock OpenAI and browser microphone services; a deployed smoke test with a
real key and physical devices is still needed for acoustic behavior and autoplay.

API references: [Realtime WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc),
[Responses function calling](https://developers.openai.com/api/docs/guides/function-calling),
[text to speech](https://developers.openai.com/api/docs/guides/text-to-speech),
[transcription](https://developers.openai.com/api/docs/guides/speech-to-text), and
[web search](https://developers.openai.com/api/docs/guides/tools-web-search).
