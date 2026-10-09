# Jarvis voice assistant

Jarvis is available from the signed-in app header. Click **Start live conversation**
and allow microphone access to talk immediately. Alternatively click **Enable
microphone** once, allow access, then say **Hello Jarvis** to open the panel and wake
Jarvis. The immediate browser greeting is **Hello Sir**. Supported browsers now use
OpenAI Realtime over WebRTC for streaming audio, captions, follow-up questions and
spoken interruptions. Live speech uses Cedar; typed/manual answers use the existing
Onyx speech endpoint. Greek transcriptions of the English wake/stop phrases are
recognized, including “Χέλο Τζάρβις” and “Τζάρβις στοπ”.
Say **Jarvis stop** to hear **Goodbye sir** and return to wake listening. Use
**Turn microphone off** to release the microphone completely.

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
  follow the user's question language. English and Greek voice input are offered.
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

The next useful improvement is an on-demand morning briefing combining today’s
and overdue tasks, upcoming bills and monthly spending, with links to each item.
It can use these read tools; scheduled delivery would need separate preferences
and scheduling work.

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

Where microphone access and RTCPeerConnection are available, live WebRTC audio is
sent to OpenAI, including ambient speech while waiting for a wake phrase. The model
does not generate answers while asleep: server VAD has automatic responses disabled,
and the app creates responses only after activation. Wake/stop and ignored speech
items are removed from the session conversation. Closing the panel keeps the
connection open while foregrounded. Turning the microphone off, signing out,
changing household, leaving the app foreground, or losing the connection closes
WebRTC, stops all microphone tracks and discards pending lookups/replies. A failed
connection displays a retry message; Record question and text remain available.
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
