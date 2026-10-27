# Jarvis

Jarvis is available from the **Jarvis** button in the signed-in app header. It answers everyday
questions through the OpenAI Responses API and adds expenses, income, and household tasks using the
existing backend services. Transaction deletion is soft deletion with normal balance, analytics, and
audit updates.

## Setup

No new packages or Python process are needed. Node.js 22's native `fetch` calls OpenAI from Firebase
Functions; the web client never receives the API key.

For local development, create **functions/.secret.local** (ignored by Git):

```dotenv
OPENAI_API_KEY=<your OpenAI project API key>
```

Optionally set the model in **functions/.env.local**:

```dotenv
JARVIS_MODEL=gpt-6-luna
```

Use a model your OpenAI project can access that supports Responses function calling and strict tool
schemas. API billing/quota is separate from a ChatGPT subscription. There is no fake provider response
in the emulator: live conversation requires a working key and internet. Automated tests mock OpenAI.

The API model ID is `gpt-6-luna`. To check access with your project key from zsh:

```zsh
read -rs "OPENAI_API_KEY?Paste your OpenAI API key: "
printf '\n'
curl --fail-with-body --silent --show-error \
  https://api.openai.com/v1/models/gpt-6-luna \
  -H "Authorization: Bearer $OPENAI_API_KEY"
unset OPENAI_API_KEY
```

A `model_not_found` response means the ID is invalid or your project cannot access it.
Check the exact ID and project access before changing `JARVIS_MODEL`.

```bash
npm run emulators
npm run dev
```

For production, provision the secret, set `JARVIS_MODEL` in `functions/.env.<project-id>` if desired,
then build and deploy through the normal release workflow:

```bash
firebase functions:secrets:set OPENAI_API_KEY --project <project-id>
npm run build
firebase deploy --only functions:jarvisChat,functions:jarvisAction,hosting,firestore:indexes --project <project-id>
```

Deploying indexes includes TTL policies for the three private Jarvis collections. Verify those
policies become active in Firestore. TTL removal is asynchronous; logical session expiry and action
expiry are enforced independently by the application. Existing default-deny rules already block all
client reads and writes to these collections. Keep existing production authentication and App Check
configuration enabled as appropriate for the project.

## Voice and examples

1. Open Jarvis, select English or Greek, and optionally select a default account.
2. Click **Enable voice** and grant microphone permission. Say **Hey Jarvis** to open the panel,
   including after closing it. You can include your command in the same utterance.
3. While the panel is active, speak naturally without repeating the wake phrase.
4. Say **Jarvis stop** to close the panel, cancel speech, discard unsent work, and return to listening
   for the next wake phrase. **Turn microphone off** ends recognition completely.

**Hey Jarvis** by itself now displays and speaks an acknowledgement; it does not call OpenAI.
Ask a question or give a command afterward, or include it in the same utterance. Open **Voice settings**
for language, account, spoken-reply, and confirmation preferences. The text box stays visible while
conversation history scrolls separately.

The voice feedback area shows **Hearing:** for provisional recognition and **Heard:** for final
recognition. Only final speech can submit a request. If no words arrive, the panel explains how to
check the microphone/language or test by typing. Speech-end events ask the browser to finalize the
utterance before listening resumes.

To diagnose a production problem, type “What is 2 plus 2?” and press **Send**. Filter browser Network
requests for `jarvis`: expect a `jarvisChat` POST. If typing works but voice produces no **Heard:** text,
check browser/OS microphone permission, the selected input device, and the voice language. If words
appear but no request is sent, wait for any spoken reply to finish, then repeat the command.
An addition with confirmation enabled or a deletion produces a preview first; `jarvisAction` is sent
when you confirm or cancel. Browser recognition traffic itself need not appear as an app fetch call.

The browser is asked for up to three transcript alternatives. Supported browsers also receive
contextual hints for “Jarvis”; providers that reject hints fall back to ordinary recognition.
Common name variants such as “Jervis” and “Jarivs” can wake the panel. Alternate hypotheses are used
only for a standalone wake phrase, never to replace a spoken amount, command, or confirmation.
An unrelated standalone greeting such as “hey Debbie's” shows a local correction prompt rather than
calling GPT. Clicking the header's **Jarvis** button also activates conversation, so you can ask a
question directly without the wake phrase.

OpenAI failures report a specific HTTP category (authentication, missing/inaccessible model,
permissions, request configuration, quota, rate limits, or temporary outage). Logs contain only
HTTP status, the configured model ID, allowlisted provider error codes, and a provider request ID.
Raw provider messages and response bodies are never logged or returned. A model error requires
correcting the server's `JARVIS_MODEL`/project access and redeploying `jarvisChat`; microphone settings
cannot fix it.

Examples:

- “Hey Jarvis, why is the sky blue?”
- “Hey Jarvis, add 30 euro supermarket as an expense.”
- “Hey Jarvis, add income 1500 euro salary.”
- “Hey Jarvis, delete yesterday's 30 euro supermarket transaction.” Then review the exact record
  and say “confirm” or “cancel”, or use the buttons.
- “Hey Jarvis, add buy milk to the Shopping list tomorrow.”

Clear additions save immediately by default. Enable **Confirm additions before saving** for previews.
Deletion always needs a separate confirmation. If an account/category/list or deletion target is
ambiguous, Jarvis asks a follow-up question. Categories and lists must already exist. Missing task
lists are left unspecified; these tasks appear in the normal task workspace. Greek uses an explicit
recognition-language switch; English wake/stop phrases stay the same in either language.

The text box is available in all browsers. Speech recognition support varies; feature detection
disables the voice button when unavailable. Use HTTPS or localhost. The active page must remain
visible; changing tabs or locking the device pauses voice and requires enabling it again. A website
cannot promise system-wide activation, activation with the browser closed, or locked-phone listening.
That would require a separately installed native companion with OS microphone/background support.

Spoken answers use browser text-to-speech, so available voices and quality depend on the device.
Jarvis ignores regular recognition results while speaking and briefly afterward to reduce speaker
echo; the exact stop phrase remains active. Wait for the spoken reply to end before a follow-up.

## Data, limits, and failure behavior

- Microphone listening starts only after opt-in; reloading requires a new opt-in. Browser speech
  recognition may send audio to the browser vendor's service. It is not a local-only wake-word engine.
- OpenAI receives the submitted text, up to 12 recent conversation messages, household-local date,
  timezone/currency, active account names/IDs/currencies, category names/IDs/types, and task list names/IDs.
  Account balances are not sent. Transaction descriptions/amounts/dates/account names are sent only
  when the model invokes transaction search.
- OpenAI requests use `store: false`. Provider-side abuse-monitoring retention and account policies
  are governed by the OpenAI account; this flag is not a promise of zero provider retention.
- Private server conversations, action receipts, and rate-limit records have 24-hour TTL timestamps.
  Local browser storage contains only language and default-account preferences. Visible conversation
  text is in memory and **New conversation** clears it and starts a new session.
- At most 20 chat requests per minute per user, four model rounds per message, one mutation per
  message, 200 accounts/categories/lists, and 2,000 input characters. Model work has a shared 50-second
  timeout budget. There is no automatic provider retry.
- Deletion search scans up to 100 most recent records, optionally on an exact household-local date.
  If the search window is truncated or several records match, narrow the date/description. Jarvis
  never interprets a truncated search as proof of a unique match.
- Prepared actions expire in 10 minutes. Confirmations accept only an opaque request ID and decision;
  clients cannot replace prepared amounts, account IDs, or deletion targets.
- Financial/task mutation and the completion receipt commit in one Firestore transaction. Retrying
  the same confirmation returns the recorded result. Repeated **new** commands create new actions.
- Confirmations recheck membership and current domain relations. Deletion rejects records changed
  since preview. The server also binds requests to the actor, household, and conversation.
- Stopping during an OpenAI request discards its response and cancels any returned proposal. A mutation
  already sent to the server may finish; stopping cannot undo a committed write. The app still
  refreshes balances/tasks after such a commit.
- Everyday answers use model knowledge; live web search, current weather/news, reminders, recurring
  todos, task assignment, category creation, and external application actions are not supplied tools.

## Implementation and verification

`packages/shared/src/schemas/jarvis.ts` defines callable contracts.
`functions/src/services/jarvis-agent.ts` contains the runtime master prompt and strict tool schemas.
`functions/src/services/jarvis.ts` handles authentication, context, private sessions, rate limits,
proposals, confirmation, and idempotency. Existing transaction/task services expose their read-first
mutation planners so receipts and normal financial/task effects can commit together.
`apps/web/src/features/jarvis` contains the panel, voice parser, and browser recognition lifecycle.

```bash
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run build
```

Unit/component tests cover everyday answers, strict tools, tool validation/continuation, wake/stop
and echo handling, preparation without mutation, accounting, soft deletion, duplicate confirmations,
ambiguous searches, stale previews, revoked membership, session isolation, expiry, and todos.
Perform a real microphone smoke test on each intended device/browser after provisioning the key;
synthetic tests cannot establish recognition accuracy, device speech quality, or provider access.

References: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling),
[model configuration](https://developers.openai.com/api/docs/models/gpt-6-luna),
[browser speech recognition and its compatibility limits](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
