# Jarvis voice assistant

Jarvis is available from the signed-in app header. Click **Enable microphone** once,
allow microphone access, then say **Hello Jarvis**. The immediate browser greeting
is **Hello Sir**. Questions receive a text answer and AI-generated speech (Onyx).
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
firebase deploy --only functions:jarvisChat,functions:jarvisTranscribe,functions:jarvisSpeak,hosting --project <your-project>
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
```

Use compatible replacements as models are retired. The chat model must support the
Responses API, function tools, and web search when enabled. The speech endpoint
must support the `onyx` voice and MP3 output. Redeploy Functions after changing
configuration or the secret. No new npm packages are required.

## Capabilities and expense confirmation

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
- AI tools cannot save, edit, delete, or book anything. Discarding a draft makes no
  financial changes. Multiple expenses require separate requests.

All three callable functions require a verified signed-in user and household
membership. Document IDs and tool arguments are validated on the server. OpenAI
requests use `store: false`; no transcript is stored in Firestore. A private
server-only usage counter allows 30 AI endpoint calls per minute and 1,000 per UTC
day per user, shared across all three endpoints. This includes transcription while
waiting for a wake phrase. These limits do not replace provider billing controls.

## Browser behavior and privacy

Serve the app over HTTPS (localhost works for development). Browser security
requires a first click and microphone permission: wake listening cannot start
automatically on first page load.

Where available, browser SpeechRecognition handles wake commands and questions.
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

API references: [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling),
[text to speech](https://developers.openai.com/api/docs/guides/text-to-speech),
[transcription](https://developers.openai.com/api/docs/guides/speech-to-text), and
[web search](https://developers.openai.com/api/docs/guides/tools-web-search).
