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
- Expenses, income, and atomic transfers with soft deletion and audit trails
- Hierarchical categories and fast mobile-first manual entry
- Paginated/filterable transaction history and CSV export
- Monthly aggregate analytics; transfers and deleted records are excluded
- Installable PWA with offline shell and Firestore persistence
- Provider-independent PSD2 integration with Salt Edge API V6 and a deterministic local mock

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

Hosting serves `apps/web/dist` and rewrites client routes to `index.html`. Firestore indexes and rules are deployed from the repository root. Functions target Node.js 22.

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

## Open Banking

`OpenBankingProvider` isolates the application from providers. `SaltEdgeProvider` implements Salt Edge Account Information API V6; `MockBankProvider` runs locally and models Alpha Bank, Eurobank, and National Bank of Greece, checking/card accounts, pending-to-booked IDs, duplicate records, balances, consent expiry, and refresh cooldowns. No scraping or bank credentials are used.

For local use, set `OPEN_BANKING_PROVIDER=mock` in the Functions environment, start the emulators, open **Settings → Bank connections**, and connect one of the three banks. The mock's initial sync supplies a pending card purchase and a booked transaction for review; the next eligible refresh books the pending purchase under a changed provider ID.

For production:

1. Obtain a Salt Edge Account Information client account and the contractual/PSD2 coverage needed for the intended Greek institutions.
2. Store `SALTEDGE_APP_ID`, `SALTEDGE_SECRET`, and the PEM-encoded `SALTEDGE_PRIVATE_KEY` with `firebase functions:secrets:set`. Upload the matching public key to the Salt Edge Dashboard; never commit either key.
3. Set `OPEN_BANKING_PROVIDER=saltedge`, the three `SALTEDGE_*_PROVIDER_CODE` values returned by the provider catalogue, the allowed frontend origin, and the success/failure URLs.
4. In Salt Edge Dashboard callbacks, configure the deployed `openBankingWebhook` HTTPS URL for Success, Failure, Notify, and Consent Status. Set `OPEN_BANKING_SUCCESS_URL`, `OPEN_BANKING_FAILURE_URL`, and `OPEN_BANKING_WEBHOOK_URL` to that same exact URL. Signature verification includes the URL, raw body, and V6 public key; progress callbacks are acknowledged and only `stage: finish` starts an import.
5. Deploy Functions, rules, and indexes, then validate the flow in Salt Edge test mode before live enablement.

Live support is not claimed until real credentials, provider codes, callbacks, and bank consents have been tested. Sync is best effort and subject to bank availability, SCA, consent duration, pending-data support, and provider refresh limits.

## V2 migration

Take a Firestore backup, then run `npm run migrate:open-banking-v2` for a dry run. Review the count and re-run with `npm run migrate:open-banking-v2 -- --apply`. The migration adds `appCalculatedBalanceMinor` from the existing cached balance, category normalization and split-reference metadata, and moves any legacy provider connection IDs to backend-only documents. It never changes transaction amounts or opening balances. Legacy live connections without a known provider customer ID require reconnecting.

## Known limitations and roadmap

- Firestore prefix search is intentionally limited to normalized description/merchant tokens; an external search adapter can later add full text.
- FX conversion and cross-currency transfers are not implemented.
- The mock bank provider is development-only; Salt Edge credentials and an appropriate provider contract are external requirements.
- Future work: Greek localization, recurring-payment detection, finer permissions, scheduled reports, push notifications, privacy deletion workflow, and a full-text search-provider adapter.

## Data ownership

Transactions can be exported as CSV. Financial documents are separate, typed collections rather than opaque blobs, leaving room for account deletion, household deletion, export, retention, and privacy-request jobs.
