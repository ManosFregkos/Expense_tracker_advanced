# Jarvis desktop companion: step-by-step implementation guide

This guide explains how to extend this expense tracker with a Python companion on
macOS. The intended result is: say **Hello Jarvis**, have a continuous spoken
conversation, record an expense with spoken confirmation, then say **Jarvis stop**
to return to wake listening. The browser can be closed while the companion runs.

**Status:** this is an implementation guide, not an installed feature. The Python
program, new desktop endpoints, and voice-save flow described below still need to
be built. New file names, API names, and CLI commands are proposed contracts.
Existing commands are identified separately. Commands that run `jarvis_desktop`
only work after its package and command handlers have been implemented.

The initial scope is one Mac, English wake/stop phrases, English or Greek
conversation, and recording expenses in the household default currency. Here,
“transaction” means a record in the expense tracker; this does not send a bank
payment. Income can be added later with its own validated proposal flow.

## 1. Understand what to keep and what to add

Keep React as the interface and Firebase as the authorized backend. Add a local
Python process for microphone input, wake/stop detection, and audio playback.

```text
Mac microphone
  -> Python companion
     -> local wake/stop detector
     -> active conversation: OpenAI Realtime WebSocket
     -> app questions: authenticated Firebase jarvisChat
     -> confirmed expense: authenticated Firebase expense confirmation

Firebase backend
  -> user/household checks
  -> OpenAI credentials and session configuration
  -> transaction validation, balances, analytics, audit records

React app
  -> displays the same saved transactions and balances
```

Useful existing files:

| File                                                     | Existing behavior to reuse                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `functions/src/services/jarvis.ts`                       | Chat, app lookups, expense drafts, voice session configuration, request budgets |
| `functions/src/services/jarvis-app-tools.ts`             | Authorized task, transaction, balance, and briefing lookups                     |
| `functions/src/services/transactions.ts`                 | Financial validation and atomic transaction/balance/analytics/audit writes      |
| `functions/src/callable.ts`                              | Verified Firebase user, callable validation, `europe-west1`, optional App Check |
| `packages/shared/src/schemas/jarvis.ts`                  | Jarvis input and draft schemas                                                  |
| `packages/shared/src/schemas/transaction.ts`             | Expense/income transaction schemas                                              |
| `packages/shared/src/utils/money.ts`                     | Exact conversion to integer minor units                                         |
| `apps/web/src/features/transactions/TransactionForm.tsx` | Existing expense review and save behavior                                       |

The existing `jarvisStartRealtime` accepts an SDP offer for browser WebRTC. A
Python WebSocket client cannot simply call it with microphone audio. The current
`jarvisChat` also returns a draft, not a saved expense.

## 2. Prepare a working development environment

Install Node.js 22+, Java 21 for the Firebase emulators, and Python 3.11 or 3.12
for the proposed companion. Have a working microphone and use headphones for
initial testing.

From the repository root, these are **existing commands**:

```bash
npm install
cp .env.example apps/web/.env.local
npm run emulators
```

Run the web app in another terminal:

```bash
npm run dev
```

If `apps/web/.env.local` already exists, edit it instead of overwriting it. Enable
`VITE_USE_FIREBASE_EMULATORS=true`. This repository uses Auth port `9099`, Functions
port `5001`, and Firestore port `8088`.

Create a verified emulator user and household, plus a cash account and an active
expense category such as Groceries. Record a small manual expense and confirm the
account balance updates. Alternatively, use the existing `npm run seed` command
for emulator demo data.

For live AI testing, put `OPENAI_API_KEY=...` in the untracked
`functions/.secret.local`, then restart the Functions emulator. Firebase emulation
does **not** emulate OpenAI: real voice requests still use the provider and its
billing. First verify that an authenticated `jarvisChat` request returns a reply;
resolve backend/model/key errors before debugging microphone behavior.

**Checkpoint:** the existing app can save an expense, and Jarvis can answer a text
question through the emulator backend.

## 3. Create the Python companion package

Create the following proposed structure:

```text
apps/jarvis-desktop/
  pyproject.toml
  .env.example
  models/
  jarvis_desktop/
    __init__.py
    __main__.py       # CLI commands and startup
    config.py        # environment and selected devices
    auth.py          # Firebase sign-in, token refresh, Keychain storage
    firebase_api.py  # callable HTTP protocol
    audio.py         # input stream, resampling, playback queue
    wake.py          # local wake/stop phrase models
    realtime.py      # connection, events, tool results
    conversation.py  # state machine, confirmation, cancellation
  tests/
```

Initial environment setup, run from the repository root:

```bash
mkdir -p apps/jarvis-desktop
python3 -m venv apps/jarvis-desktop/.venv
source apps/jarvis-desktop/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install pvporcupine sounddevice numpy scipy websockets httpx python-dotenv keyring pytest
```

These commands prepare dependencies; they do not implement the companion. After
the microphone and WebSocket smoke tests pass, pin the tested versions in
`pyproject.toml` and commit a dependency lock file.

Add `.venv/`, `__pycache__/`, `.pytest_cache/`, and private downloaded model files
to `.gitignore`. The existing ignore rules already exclude `.env` and `.env.*`
except `.env.example`.

Create the proposed `apps/jarvis-desktop/.env.example`:

```dotenv
JARVIS_FIREBASE_PROJECT_ID=demo-family-expense-tracker
JARVIS_FIREBASE_API_KEY=demo-api-key
JARVIS_FIREBASE_REGION=europe-west1
JARVIS_USE_EMULATORS=true
JARVIS_AUTH_EMULATOR_HOST=127.0.0.1:9099
JARVIS_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
JARVIS_HOUSEHOLD_ID=replace-with-your-household-id
JARVIS_LANGUAGE=en-US
JARVIS_PICOVOICE_ACCESS_KEY=replace-with-your-access-key
JARVIS_WAKE_MODEL=models/hello-jarvis.ppn
JARVIS_STOP_MODEL=models/jarvis-stop.ppn
```

Copy it to `.env` inside that directory. Resolve model paths relative to the
configuration file so startup works outside the project directory. Keep the
permanent OpenAI key on the backend. Do not put a Firebase Admin service-account
key in this client.

## 4. Get wake and stop phrase models

For this Mac implementation, use Porcupine and create two custom English phrase
models in the Picovoice Console: **Hello Jarvis** and **Jarvis stop**. Download the
models for your Mac platform, place them under `models/`, and configure their
actual filenames. Porcupine supports Python on macOS x86_64 and arm64 and loads
custom `.ppn` files through `keyword_paths`. Obtain an access key and check the
account's applicable licensing before distributing the companion.
[Porcupine Python instructions](https://picovoice.ai/docs/quick-start/porcupine-python/).

In `wake.py`, initialize the detector with both model paths. Feed it mono PCM16
frames using its reported `sample_rate` and `frame_length`. In sleep mode, act only
on the wake phrase. In active modes, act on the stop phrase. Debounce repeat
detections so one utterance cannot start several connections.

Implement a local-only `test-wake` command that prints detections without opening
a cloud connection. An English wake phrase can activate Greek conversation;
Greek conversation does not require a Greek wake model.

**Checkpoint:** repeated “Hello Jarvis” and “Jarvis stop” detections work with your
microphone, accent, and normal room noise. Adjust sensitivity based on both missed
phrases and false activations. Custom models still need physical testing.

## 5. Establish microphone capture and playback

In `audio.py`, use `sounddevice` for one microphone capture stream and a separate
playback queue. On macOS its pip installation supplies PortAudio.
[sounddevice installation](https://github.com/spatialaudio/python-sounddevice/blob/master/doc/installation.rst).

Implement a `devices` command to list input/output devices and a `test-audio`
command to record and replay a short sample. Grant microphone permission to the
terminal or packaged application that runs Python.

Use one capture stream, then resample it for each consumer. Porcupine needs its
reported sample rate; configure Realtime PCM audio at 24 kHz. Use a streaming
resampler with persistent state, correct mono PCM16 little-endian encoding, and
bounded queues. Never block the microphone callback on a network request.

First use headphones. Speaker operation needs an echo-cancellation path and
separate acceptance testing. Muting all microphone input during Jarvis speech
would prevent “Jarvis stop” from interrupting it.

**Checkpoint:** audio is intelligible at normal speed, with no buffer growth,
crackling, or dropped capture when playback starts.

## 6. Sign in as an ordinary Firebase user

Implement `auth.py` using Firebase Auth REST. For the first version, use an
email/password account with a verified email. Prompt for the password with
`getpass`; do not put it in a CLI argument or `.env`. If the account is Google-only,
implement browser-based sign-in/pairing before using it with the companion.

Production sign-in uses:

```text
POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<FIREBASE_API_KEY>
Body: {"email":"...","password":"...","returnSecureToken":true}
```

For emulator sign-in, use the corresponding endpoint under
`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/`.

Keep the ID token in memory, store the refresh token in macOS Keychain, and refresh
before expiry through the Secure Token API. Persist any replacement refresh token.
Implement logout that deletes the stored credential. Firebase's REST documentation
defines the sign-in and refresh request/response fields.
[Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth).

The companion must use the existing user's UID. Select a household only after the
backend verifies membership. Add a proposed `jarvisDesktopContext` callable to
return authorized household name, time zone, currency, active accounts including
their owners, and expense categories. Never rely on a configured household ID as
proof of access.

**Checkpoint:** authenticated app lookups succeed; an unverified user or a user
outside the selected household is rejected.

## 7. Implement the Firebase callable client and production App Check

Use the callable protocol, not a plain JSON REST body:

```text
POST https://europe-west1-<PROJECT_ID>.cloudfunctions.net/jarvisChat
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json

{
  "data": {
    "householdId": "<HOUSEHOLD_ID>",
    "messages": [{"role":"user","content":"How much did I spend this month?"}],
    "language": "en-US",
    "webSearch": false
  }
}
```

The emulator URL is
`http://127.0.0.1:5001/<PROJECT_ID>/europe-west1/jarvisChat`. Decode the callable
result envelope, handle its error envelope even when present in a JSON response,
and set network timeouts. Serialize token refresh when concurrent requests need it.
[Firebase callable protocol](https://firebase.google.com/docs/functions/callable-reference).

The repository conditionally enforces App Check with `ENFORCE_APP_CHECK`. A Python
client cannot use the browser's reCAPTCHA integration automatically. Before
production with enforcement, implement a desktop custom provider: enroll the
device through the signed-in web app, register a device public key, verify signed
single-use server challenges, and issue short-lived App Check tokens. Device
revocation must stop token issuance. Send issued tokens in `X-Firebase-AppCheck`.

Device enrollment and challenge endpoints need their own authentication,
authorization, replay protection, and rate limits; the token-exchange bootstrap
must not require a token it has not yet issued. This enrollment design is proposed
work, not a built-in Python Firebase feature. Firebase requires a secure backend
to assess authenticity and mint tokens.
[Custom App Check provider](https://firebase.google.com/docs/app-check/custom-provider).

For emulator development, use a development configuration without enforcement.
Do not disable production App Check globally to make this client work.

**Checkpoint:** Python can call `jarvisChat`, refresh its login, and satisfy the
deployed backend's App Check policy before production rollout.

## 8. Add an authenticated desktop Realtime session endpoint

Add a proposed `jarvisCreateDesktopSession` callable in
`functions/src/services/jarvis.ts` and export it from `functions/src/index.ts`.
Add its input/output schemas to the shared package. Input should include
`householdId`, `language`, and `webSearch`.

The endpoint must check verified sign-in and household membership, reserve a
Jarvis request, and build session settings on the server. Extract shared session
configuration from `jarvisStartRealtime` to avoid divergent browser/desktop rules.
Retain the configured model parameter and verify that your API project can use it.

The server then uses its permanent key to call
`POST https://api.openai.com/v1/realtime/client_secrets`. Return the short-lived
credential, its expiry, and the selected model to Python. Keep the credential in
memory and acquire it only after wake detection. OpenAI documents this endpoint
for creating a client secret with session settings.
[Realtime client secrets](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create).

Use the temporary credential for a Realtime WebSocket connection. Confirm that
authentication succeeds in an isolated connection smoke test before connecting
microphone capture. A credential's expiry limits new connection authentication;
it is not a running-session spending cap. Set a companion session duration and
idle timeout, plus provider billing controls. Client controls alone are not a
server-enforced hard quota. Do not log or persist the returned credential.
[Official OpenAI WebSocket documentation](https://developers.openai.com/api/docs/guides/voice-websockets).

**Checkpoint:** Python opens an authorized session and receives session events;
sleep mode never opens a conversation socket.

## 9. Implement continuous conversation and app tool routing

Implement concurrent capture/upload, socket event handling, and audio playback
in `realtime.py`. Configure voice activity detection, input transcription, and
spoken output. Start with the existing language and voice settings.

Handle at least these events:

| Event or action                         | Companion behavior                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `input_audio_buffer.append`             | Send Base64-encoded captured PCM chunks while active                              |
| Completed input transcription           | Handle stop/confirmation first, otherwise process the user's turn                 |
| `response.output_audio.delta`           | Decode audio chunks and enqueue playback                                          |
| `response.output_audio_transcript.done` | Display the assistant caption                                                     |
| Function-call arguments complete        | Validate the requested tool and call the authorized app backend                   |
| User speech starts during output        | Cancel output and remove queued playback; track how much audio was heard          |
| Connection/error events                 | Explain failure, clear pending confirmation, and recover without duplicate writes |

The WebSocket client owns playback cancellation and must truncate unplayed audio
from conversation context when interrupted. Use the current GA event/schema
definitions; do not mix old beta audio event names into this implementation.
[Realtime conversations and interruptions](https://developers.openai.com/api/docs/guides/realtime-conversations).

Keep automatic response creation disabled initially, matching the current app.
After a completed ordinary user turn, explicitly create a response. This lets the
companion consume stop and confirmation commands without inviting the model to
answer them first. Treat partial transcripts as captions, not financial authority.

Keep `ask_app_assistant` as the app lookup tool. On a call, forward the request
and recent text context to `jarvisChat`, then return a matching function-call
output to Realtime and continue the response. Deduplicate tool call IDs. The
current chat schema permits at most 20 messages and requires a final user message.

For a returned expense draft, hand it to the confirmation controller described
below. The existing backend says drafts require form review; the desktop should
supply an accurate “pending spoken confirmation; not saved” tool result and use
desktop-specific instructions. Keep browser review/save behavior intact.

**Checkpoint:** ask a general question, a follow-up, and a balance/spending
question without waking Jarvis again between turns. App answers use real backend
results and do not invent household data.

## 10. Make wake, active, and sleep behavior explicit

Implement these states in `conversation.py`:

| State                   | Behavior                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| `SLEEPING`              | Only local wake detection; no microphone upload or Realtime socket            |
| `CONNECTING`            | One session connection in progress; local stop remains available              |
| `ACTIVE`                | Continuous conversation; local stop and interruptions remain available        |
| `AWAITING_CONFIRMATION` | One fully specified expense has been read back; wait for an explicit answer   |
| `SAVING`                | One confirmation request in progress; prevent a second save                   |
| `OFF`                   | Release the microphone and all connections; a UI/CLI action must re-enable it |

On **Hello Jarvis**, leave sleep, connect once, greet the user, and enter active
conversation. Preserve a short audio prebuffer if you want to support a question
in the same utterance. Otherwise, tell users to wait for the greeting during the
first version; do not silently drop their first question.

On **Jarvis stop**, immediately clear playback, cancel the current response,
invalidate outstanding conversation work, discard unsaved proposals, close the
socket, and return to local wake listening. A short local goodbye is optional.
Do not wait for cloud transcription or an AI response to stop.

Use a generation/session ID: every pending connection, tool call, draft, and
playback chunk must belong to the current generation. Ignore late results from a
stopped conversation. Sleep timeout and connection failure should also invalidate
the generation. Stop detection must work during connection, tool work, and speech.

**Checkpoint:** stop Jarvis while it is answering, then wake it again. No old
reply or proposal appears in the new conversation.

## 11. Add expense proposals and atomic confirmed saves

Do this before enabling spoken saving. The current `createTransaction` allocates
a new document on each call: retrying it after a lost response could duplicate an
expense. The proposed voice path needs durable server-side proposals and an
idempotent commit.

Add these proposed callables:

| Callable               | Input                                            | Result                                                        |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `jarvisPrepareExpense` | Household ID, client request ID, validated draft | Proposal ID, expiry, canonical readback fields                |
| `jarvisConfirmExpense` | Household ID, proposal ID                        | Saved transaction ID; repeat calls return the same ID         |
| `jarvisCancelExpense`  | Household ID, proposal ID                        | Cancelled, or already committed with its transaction ID       |
| `jarvisExpenseStatus`  | Household ID, proposal ID                        | Pending, cancelled, expired, or committed with transaction ID |

Store proposals in a backend-only collection such as `privateJarvisExpenseProposals`.
Add an explicit client-deny Firestore rule, inspect existing catch-all rules, and
test that normal clients cannot read/write proposals. Bind each proposal to the
requesting UID, household, and client request ID. Make preparation retries return
the same proposal for the same actor/request; reject the same request ID with
different content.

During preparation, validate amount, currency, account, category, and date. Derive
the payer from the selected account's stored owner. Do not assume it is the
speaker: existing transactions require `ownerUserId` to match account ownership.
Ask for missing or ambiguous account/category choices instead of guessing. Begin
with the default currency, matching current Jarvis draft restrictions.

Use the shared `parseMoneyToMinor` helper on the server: €25 becomes `2500`, never
a floating-point calculation. A draft has a `YYYY-MM-DD` date, while transaction
input needs an ISO datetime. Convert the confirmed date to local noon in the
household's IANA time zone, then to UTC; preserve the confirmed calendar day and
test daylight-saving boundaries. The current browser form uses device-local noon,
so extract a server helper rather than importing a browser module.

Read back the server's canonical fields: amount, currency, expense description,
account and payer, category, and full date. Give the proposal a short expiry,
such as two minutes. An edit creates a new preview and invalidates the old one.

For commit, extract an internal transaction-creation helper from
`transactions.ts` that accepts a trusted actor and participates in the same
Firestore transaction as proposal consumption. Reuse financial validation,
balance effects, analytics, search fields, and audit writing. Do not call a
separate create callable and mark the proposal committed afterward.

The atomic commit must:

1. Read the proposal and check actor/household binding.
2. Return the existing transaction ID if it was already committed by this actor.
3. Otherwise require an unexpired, uncancelled pending proposal.
4. Recheck membership and financial relationships before the write.
5. Create exactly one transaction, apply its financial effects and audit writes,
   and mark the proposal committed in the same Firestore transaction.

Concurrent cancellation and confirmation must resolve to one consistent result.
If stop arrives after a save request was sent, it cannot undo a committed expense.
Reconcile status and show the result even if voice has returned to sleep.

**Checkpoint:** two confirmation requests, a concurrent retry, or a lost-response
retry yield one expense and one balance change. Expired/cancelled proposals and
cross-user access are rejected.

## 12. Add the spoken confirmation controller

Only enter `AWAITING_CONFIRMATION` after the complete canonical preview has been
played. Use completed user transcripts and a small explicit phrase allowlist,
such as **Confirm** / **Confirm expense**, or Greek **Επιβεβαίωση**. Treat cancel,
stop, expiry, or a changed request as invalidation. Keep ordinary conversation
separate from confirmation; a general “yes” elsewhere must not save anything.

If the readback is interrupted, require a fresh full readback before accepting
confirmation. Deduplicate transcript/item IDs, allow one save at a time, and
never expose `jarvisConfirmExpense` as a freely selectable AI tool. The model can
propose; the local confirmation controller invokes the write after the user's
explicit confirmation.

Say “Saved” only after a successful backend result. If the result is uncertain,
say that confirmation is being checked and query status or retry the same proposal
ID. Do not prepare another expense to recover from a timeout. Preserve an
unresolved operation ID across a crash without storing the full conversation.

The target interaction is:

```text
You:     Hello Jarvis.
Jarvis:  Hello, sir.
You:     Record 25 euros for groceries from my cash account today.
Jarvis:  25 euros for groceries, from Cash owned by Manos,
         category Groceries, dated 13 October 2026. Confirm expense?
You:     Confirm expense.
Jarvis:  Saved.
You:     How much have I spent this month?
Jarvis:  [Answer from the authorized app data.]
You:     Jarvis stop.
Jarvis:  Goodbye, sir.
```

The displayed example date must be replaced by the actual confirmed date at
runtime. Local wake/stop phrases remain English when conversation is Greek.

## 13. Test the complete scenario before production

Implement these proposed Python commands, then run them from
`apps/jarvis-desktop` with the virtual environment active:

```bash
python -m jarvis_desktop devices
python -m jarvis_desktop test-audio
python -m jarvis_desktop test-wake
python -m jarvis_desktop login
python -m jarvis_desktop run
```

Run the existing repository checks after implementing the backend/shared changes:

```bash
npm run typecheck
npm run lint
npm run test --workspace=@family-expense-tracker/functions
npm run test --workspace=@family-expense-tracker/shared
npm run test:rules
npm run build
```

Add focused tests for proposal authorization, expiry, financial effects,
idempotency, cancel/commit races, and generation invalidation. Run companion tests
with `python -m pytest` from its directory. Browser integration tests are needed if
you change browser behavior or shared browser session settings.

Perform this physical-device acceptance checklist:

- Wake from sleep and hold several follow-up turns without another wake phrase.
- Stop during connection, an app lookup, and spoken output; wake again successfully.
- Close the browser: wake, conversation, and app lookup still work.
- Record €25, explicitly confirm, and find exactly one expense in the app.
- Check that the account decreases by €25 and monthly analytics update.
- Ask “How much did I spend?” and confirm the new expense is included for its payer.
- Cancel or stop before confirmation: no expense is created.
- Repeat a confirmation or simulate a lost network response: no duplicate expense.
- Refresh expired login credentials and reject a removed household member.
- Revoke desktop enrollment when App Check is enabled: subsequent access fails.
- Deny microphone permission, unplug the device, and disconnect the network:
  show a recoverable error without claiming a save.
- Observe network traffic after “Jarvis stop”: microphone audio is not uploaded.
- Test speaker echo separately before promising hands-free speaker operation.
- While the web page is open, confirm the saved transaction appears through its
  subscription or add an explicit refresh/invalidation path for relevant cached data.

Record actual wake accuracy, interruption delay, first-response delay, and idle
resource use on your Mac. Mocked tests cannot establish acoustic reliability.

## 14. Deploy and arrange startup

After implementation and the checkpoints pass, use production Firebase settings
in the companion and keep `JARVIS_USE_EMULATORS=false`. Complete desktop App Check
support when enforcement is enabled.

Set the backend secret using the existing Firebase workflow:

```bash
firebase functions:secrets:set OPENAI_API_KEY --project <YOUR_PROJECT_ID>
```

Build, then deploy the functions implemented by this guide. **This example
deployment command is only valid after those new exports exist:**

```bash
npm run build
firebase deploy --project <YOUR_PROJECT_ID> --only functions:jarvisChat,functions:jarvisDesktopContext,functions:jarvisCreateDesktopSession,functions:jarvisPrepareExpense,functions:jarvisConfirmExpense,functions:jarvisCancelExpense,functions:jarvisExpenseStatus,firestore:rules
```

Include custom App Check enrollment/token-exchange functions in deployment if
added. Deploy Hosting as well if you implement enrollment/settings pages. Deploy
the browser Realtime function if you change its shared configuration. Follow the
existing [production deployment guide](PRODUCTION_DEPLOYMENT.md) for project setup
and rollout, and [Jarvis guide](JARVIS.md) for model configuration.

First run the companion manually against production using a small test expense.
Only after that succeeds, implement a macOS LaunchAgent or package a menu-bar app
with a login item. A LaunchAgent should use absolute paths for the virtualenv
Python, working directory, and config file; launchd does not activate a shell
virtualenv or read `.zshrc`. Add restart backoff and avoid multiple microphone
processes. Keep credentials in Keychain, not the startup definition.

Provide visible Sleeping/Active/Off status, a microphone-off control, and logout.
Disable browser Jarvis listening when the desktop companion handles the same
microphone. Keep the ordinary browser expense review/save flow available.

Jarvis sleep keeps a local wake detector running. Turning the companion off
releases the microphone. Putting the **Mac itself** to sleep stops this ordinary
Python process from detecting speech; a dedicated always-on device is needed if
you want wake listening while the Mac is asleep.

The implementation is complete when the acceptance checklist passes on the
deployed backend and your actual microphone, with the browser closed.
