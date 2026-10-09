# Family Expense Tracker

Production-oriented, household-centric expense tracking SaaS built with React, TypeScript, Firebase, and integer minor-unit accounting. Adults retain individual account ownership while every household member has shared financial visibility.

The V1 implementation is complete. See [Implementation plan](docs/IMPLEMENTATION_PLAN.md) for phase status and [Architecture](docs/ARCHITECTURE.md) for design decisions.

## Quick start

Prerequisites: Node.js 22+, Java 21 (Firebase emulators), and Firebase CLI.

```bash
npm install
cp .env.example apps/web/.env.local
npm run emulators
npm run dev
```

The web app runs at `http://localhost:5173`; Emulator UI runs at `http://localhost:4000`, Firestore at `127.0.0.1:8088`, and emulated Hosting at `http://localhost:5050`. Set `VITE_USE_FIREBASE_EMULATORS=true` for local development. No production credentials or bank secrets are committed.

## Commands

```bash
npm run dev           # Vite web app
npm run emulators     # Auth, Firestore, Functions, Hosting emulator suite
npm run seed          # optional emulator-only Fregkos Family data
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run test:e2e
npm run build
```

## Product scope

- Email/password and Google authentication, protected routes, verification gates
- Multi-household domain with roles, secure invitations, and member visibility
- Individually owned bank, cash, credit-card, and debit-card accounts
- Expenses and income with soft deletion and audit trails
- Hierarchical categories and fast mobile-first manual entry
- Paginated/filterable transaction history, totals across all matching results, and CSV export
- Monthly aggregate analytics; deleted records are excluded
- Installable PWA with offline shell and Firestore persistence
- Household tasks with assignment, lists, subtasks, recurring occurrences, reminders, and PWA push
- Bulk task completion, assignment, and rescheduling with per-task failure reporting

See [Transaction totals and bulk task actions](docs/TRANSACTION_TOTALS_AND_BULK_TASKS.md) for usage,
behavior, and deployment details.

Jarvis adds voice questions, spoken replies, wake/stop commands, everyday help,
optional web search, and expense drafts for review. See [Jarvis setup and browser support](docs/JARVIS.md).

Explicit non-goals include budgets, net worth, investments, loans, receipt OCR, recurring billing, and Splitwise-style settlement.

## Monorepo

```text
apps/web          React/Vite/Mantine PWA
functions         Firebase callable functions and backend domain services
packages/shared   Shared domain types, Zod schemas, money/date/analytics utilities
tests/rules       Firestore authorization integration tests
docs              Architecture, collections, and implementation plan
```

## Environment

Copy `.env.example` to `apps/web/.env.local`. Firebase web configuration values identify a Firebase project but are not server secrets.

App Check is initialized with a reCAPTCHA v3 provider when `VITE_FIREBASE_APPCHECK_SITE_KEY` is configured. Local emulator mode uses the App Check debug token. Callable Functions also enforce authentication, membership, roles, ownership constraints, and server-side Zod validation.

## Firebase setup and deployment

For the complete production checklist—including Git upload, production environment values,
`VITE_FIREBASE_VAPID_KEY`, FCM, App Check, staged deployment, smoke tests, and
rollback—use the [Production deployment guide](docs/PRODUCTION_DEPLOYMENT.md).

1. Create Firebase projects for development and production.
2. Enable Email/Password and Google providers, Firestore, Functions, Hosting, and App Check with a reCAPTCHA v3 site key.
3. Put project aliases in `.firebaserc`; do not commit private service-account keys.
4. Build and verify: `npm run build && npm test && npm run test:rules`.
5. Deploy with `firebase deploy --project <alias>`.

The Functions predeploy step compiles and packages the private shared workspace into `functions/vendor/shared`. Keep the generated vendor package and `functions/package-lock.json` committed so Cloud Build can install the Functions package without access to a private npm registry.

Hosting serves `apps/web/dist` and rewrites client routes to `index.html`. Firestore indexes and rules are deployed from the repository root. Functions target Node.js 22.

## Testing

- Vitest covers money, dates, transaction effects, aggregates, month moves, deletion/restoration.
- React Testing Library covers high-value forms and filters.
- Rules Unit Testing runs against the Firestore emulator and verifies household isolation and backend-only collections.
- Playwright exercises registration, onboarding, accounts, retired-route redirects, all transaction types, dashboard totals, edits, and deletion against the emulators.

The browser suite expects the emulators and web server; CI starts them automatically. Real Google sign-in is not exercised by emulator E2E.

## Accounting and balance strategy

All amounts are positive integers in currency minor units. Transaction type determines direction: expense subtracts and income adds.

`openingBalanceMinor` plus non-deleted transaction effects is the deterministic source of truth. Accounts also store `currentBalanceMinor` as a backend-maintained cache updated in the same Firestore transaction as the financial mutation and audit/analytics writes. The rebuild callable can repair monthly aggregates from source transactions.

## Security model

- Every household read checks `/households/{householdId}/members/{uid}`.
- Normal financial and membership mutations are denied to direct client writes and pass through callable Functions.
- The backend derives membership, actor, and account ownership relationships from trusted documents.
- Invitations are server-created and match the authenticated verified email on acceptance.
- Analytics and audit logs are backend-controlled. Bank provider tokens never enter client-readable documents.
- App Check enforcement is configurable during rollout; authentication and authorization never depend on App Check alone.

See [Security](docs/SECURITY.md), [Firestore model](docs/FIRESTORE.md), and `firestore.rules` for details.

## Household tasks

`/tasks` is a household-scoped Todoist-style workspace with Today, Upcoming, All, and Completed
views. It supports quick add, household assignees, custom lists, priorities, tags, date/time and
reminder shortcuts, subtasks, activity, soft deletion, URL-backed filters, search, keyboard and
pointer reordering, and a compact dashboard widget. Existing households are initialized lazily
with idempotent Home, Shopping, Appointments, Bills & Admin, and Car lists; `npm run seed` creates
the same deterministic lists for emulator demo data.

Task writes use callable Functions. Completion, activity/audit records, and recurring occurrence
creation are one Firestore transaction. Each recurring occurrence is a separate task with a
deterministic series/occurrence ID, so retries cannot create duplicate future tasks and completed
history is retained. Date-only deadlines retain an explicit household-local `dueDate`; `dueAt` is
the UTC end of that local day. Timed deadlines use an explicit IANA household timezone.

The scheduled `scheduledTaskReminders` Function runs every five minutes. Deterministic private
delivery documents and task reminder state make due/overdue delivery idempotent. The emulator logs
mock push deliveries while still creating in-app notifications. Notification preferences are off
by default and are enabled under **Settings → Task notifications**.

Users can also opt into due and overdue emails from that settings card. Emails go to the verified
sign-in address, including when the website is closed. Production requires a verified sending
domain, `TASK_EMAIL_FROM` in the Functions environment, and a `RESEND_API_KEY` Functions secret.
The Functions emulator logs mock email deliveries.

For production Web Push:

1. Enable Firebase Cloud Messaging for the Firebase web app and create a Web Push certificate.
2. Set the public key as `VITE_FIREBASE_VAPID_KEY` for the web build. It is public configuration,
   not an Admin credential.
3. Deploy Hosting and Functions so the injected PWA service worker and notification trigger are
   available over HTTPS: `firebase deploy --only hosting,functions,firestore`.
4. In Settings, explicitly enable the desired policies and click **Enable browser push** on each
   device. Tokens are stored only in backend-readable `/userDevices` documents; invalid tokens are
   removed after FCM responses.

Local task testing uses the normal `npm run emulators`, `npm run dev`, and optional `npm run seed`
commands. Rules tests cover task/list/subtask/activity isolation, and the Playwright household flow
includes task creation, completion/reopen, recurrence, and duplicate-completion behavior.

## Removed features

Bank connections and transaction review have been removed, including their callable Functions, bank webhooks, and scheduled bank refresh. Account management and its Firebase calls remain available.

Previously imported transactions remain editable and deletable. Legacy bank metadata is retained for historical records; the application no longer reads or writes bank collections. Deploy the updated Functions and Firestore rules to apply the removal in Firebase. When deploying, remove the retired Functions reported by the Firebase CLI, including `scheduledBankRefresh`, so previously deployed sync jobs stop running.

## Known limitations and roadmap

- Firestore prefix search is intentionally limited to normalized description/merchant tokens; an external search adapter can later add full text.
- FX conversion and cross-currency transactions are not implemented.
- Future work: Greek localization, recurring-payment detection, finer permissions, scheduled reports, push notifications, privacy deletion workflow, and a full-text search-provider adapter.

## Data ownership

Transactions can be exported as CSV. Financial documents are separate, typed collections rather than opaque blobs, leaving room for account deletion, household deletion, export, retention, and privacy-request jobs.

Personal notes and course learning are available in **Notes**. See [the Notes guide](docs/NOTES.md) for notebooks, Markdown, checklists, review cards, and backup/recovery.
