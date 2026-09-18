# Family Expense Tracker

Production-oriented, household-centric expense tracking SaaS built with React, TypeScript, Firebase, and integer minor-unit accounting. Adults retain individual account ownership while every household member has shared financial visibility.

The V1 implementation is complete. See [Implementation plan](docs/IMPLEMENTATION_PLAN.md) for phase status and [Architecture](docs/ARCHITECTURE.md) for design decisions.

## Quick start

Prerequisites: Node.js 20+, Java 21 (Firebase emulators), and Firebase CLI.

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
- Expenses, income, and atomic transfers with soft deletion and audit trails
- Hierarchical categories and fast mobile-first manual entry
- Paginated/filterable transaction history and CSV export
- Monthly aggregate analytics; transfers and deleted records are excluded
- Installable PWA with offline shell and Firestore persistence
- Bank-provider abstraction and emulator-only mock provider; no bank credentials or scraping

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

Copy `.env.example` to `apps/web/.env.local`. Firebase web configuration values identify a Firebase project but are not server secrets. Production bank-provider credentials must be stored with Firebase Functions secrets / Google Secret Manager and must never use `VITE_` variables.

App Check is initialized with a reCAPTCHA v3 provider when `VITE_FIREBASE_APPCHECK_SITE_KEY` is configured. Local emulator mode uses the App Check debug token. Callable Functions also enforce authentication, membership, roles, ownership constraints, and server-side Zod validation.

## Firebase setup and deployment

1. Create Firebase projects for development and production.
2. Enable Email/Password and Google providers, Firestore, Functions, Hosting, and App Check with a reCAPTCHA v3 site key.
3. Put project aliases in `.firebaserc`; do not commit private service-account keys.
4. Build and verify: `npm run build && npm test && npm run test:rules`.
5. Deploy with `firebase deploy --project <alias>`.

The Functions predeploy step compiles and packages the private shared workspace into `functions/vendor/shared`. Keep the generated vendor package and `functions/package-lock.json` committed so Cloud Build can install the Functions package without access to a private npm registry.

Hosting serves `apps/web/dist` and rewrites client routes to `index.html`. Firestore indexes and rules are deployed from the repository root. Functions target Node.js 20.

## Testing

- Vitest covers money, dates, transaction effects, aggregates, month moves, deletion/restoration, and bank idempotency.
- React Testing Library covers high-value forms and filters.
- Rules Unit Testing runs against the Firestore emulator and verifies household isolation and backend-only collections.
- Playwright exercises registration, onboarding, accounts, all transaction types, dashboard totals, edits, and deletion against the emulators.

The browser suite expects the emulators and web server; CI starts them automatically. Real Google sign-in is not exercised by emulator E2E.

## Accounting and balance strategy

All amounts are positive integers in currency minor units. Transaction type determines direction: expense subtracts, income adds, and transfer subtracts from the source while adding to the destination. A transfer is one document and never contributes to cashflow analytics.

`openingBalanceMinor` plus non-deleted transaction effects is the deterministic source of truth. Accounts also store `currentBalanceMinor` as a backend-maintained cache updated in the same Firestore transaction as the financial mutation and audit/analytics writes. The rebuild callable can repair monthly aggregates from source transactions.

## Security model

- Every household read checks `/households/{householdId}/members/{uid}`.
- Normal financial and membership mutations are denied to direct client writes and pass through callable Functions.
- The backend derives membership, actor, and account ownership relationships from trusted documents.
- Invitations are server-created and match the authenticated verified email on acceptance.
- Analytics and audit logs are backend-controlled. Bank provider tokens never enter client-readable documents.
- App Check enforcement is configurable during rollout; authentication and authorization never depend on App Check alone.

See [Security](docs/SECURITY.md), [Firestore model](docs/FIRESTORE.md), and `firestore.rules` for details.

## Bank integration

V1 is manual-first. `BankProvider` defines connection, refresh, account, transaction, and disconnect operations. `MockBankProvider` supports deterministic emulator tests. The production adapter deliberately fails with a configuration error until a regulated PSD2/Open Banking provider and server-side secrets are configured. Raw `BankTransaction` records remain separate and use deterministic IDs based on provider connection plus external transaction ID to ensure idempotent normalization.

No online-banking username/password is requested or stored, and this repository does not claim live Greek-bank support.

## Known limitations and roadmap

- Firestore prefix search is intentionally limited to normalized description/merchant tokens; an external search adapter can later add full text.
- FX conversion and cross-currency transfers are not implemented.
- The mock bank provider is development-only.
- Future work: real PSD2 provider, Greek localization, recurring-payment detection, finer permissions, scheduled reports, push notifications, privacy deletion workflow, and search-provider adapter.

## Data ownership

Transactions can be exported as CSV. Financial documents are separate, typed collections rather than opaque blobs, leaving room for account deletion, household deletion, export, retention, and privacy-request jobs.
