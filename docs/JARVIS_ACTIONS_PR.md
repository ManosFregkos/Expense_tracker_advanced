# PR #1 handoff

Suggested title: **feat: add atomic confirmed Jarvis expense and task actions**

PR creation is blocked: the GitHub connector returned HTTP 403 `Resource not accessible by integration`; the repository's existing Git credential returned HTTP 403 `Resource not accessible by personal access token`. The available browser comparison is signed out. No PR URL exists, and no credential scopes were expanded.

Branch: `feat/jarvis-voice-actions` → `main`.
[Open the branch comparison / PR form](https://github.com/ManosFregkos/Expense_tracker_advanced/compare/main...feat/jarvis-voice-actions?expand=1).

The remaining text is the prepared PR description.

## Purpose and scope

Implement PR #1 of the Jarvis 2.0 roadmap: reusable server-owned proposals for CREATE_EXPENSE, CREATE_TASK, COMPLETE_TASK and RESCHEDULE_TASK. Existing browser expense review and task approval behavior is preserved. Production was not deployed; nothing is merged.

## Implementation

- Add strict discriminated Zod action contracts and canonical proposal/result types.
- Add jarvisPrepareAction, jarvisConfirmAction, jarvisCancelAction and jarvisActionStatus through secureCallable in europe-west1.
- Bind proposals to the authenticated UID, household, UUID session and idempotency key, with a two-minute pending lifetime and conflicting-key rejection.
- Extract read/validate/commit plans from the existing transaction/task services. Confirmation commits the proposal receipt, existing domain mutation, balances/analytics, audits, activity, recurrence and notification records in one Firestore transaction.
- Revalidate membership, account/category/currency/ownership, displayed mutable details and required task versions. Keep the existing household reporting-currency restriction.
- Serialize confirmations, cancellation, expiration and retries. Successful retries return the original result.
- Deny all direct client access to proposal and per-user quota collections. Bound new preparations to 20 per minute.
- Add real emulator concurrency/integrity tests, a callable HTTP E2E scenario and a dedicated transactional CI job. Align CI with Node 22 and Java 21.

## Major files

- packages/shared/src/schemas/jarvis-actions.ts (+ exports and generated Functions shared package)
- functions/src/services/jarvis-actions.ts and functions/src/index.ts
- functions/src/services/transactions.ts and functions/src/services/tasks.ts
- firestore.rules and tests/rules/firestore.rules.test.ts
- functions/src/services/jarvis-actions.integration.test.ts
- tests/e2e/jarvis-actions.spec.ts and package.json
- .github/workflows/ci.yml
- docs/JARVIS_ACTIONS.md, JARVIS.md, JARVIS_DESKTOP_GUIDE.md, SECURITY.md and PRODUCTION_DEPLOYMENT.md

## Security and data

Verified Firebase Auth and the existing App Check enforcement configuration remain intact. Membership checks execute within proposal transactions. Clients cannot supply actor, expense-owner, source or write-authority fields. Confirmation accepts a bound proposal ID, never a replacement mutation object. No confirmation endpoint is exposed as a model tool. Preparation writes private protocol records only and does not mutate business data.

This is additive storage, with no financial/task/Notes migration or production data changes. Receipt deletion/TTL is intentionally not enabled: deleting retry-key receipts could allow duplicate actions. Bounded personal proposal payloads currently remain stored; future retention/redaction must preserve idempotency tombstones.

## Validation

- PASS: npm run typecheck.
- PASS: npm run lint.
- PASS: npm run test:jarvis-actions — 29 actual Firestore emulator integration tests (final run on Node 22.20.0 / Java 21).
- PASS: npm run test:rules — 9 rules tests, including proposal and quota read/query/create/update/delete denial.
- PASS: VITEST_MAX_WORKERS=1 npm test on Node 22.20.0 — 175 unit tests (80 frontend, 36 Functions, 59 shared). The 29 financial integration cases are deliberately skipped in this command and passed separately against Firestore.
- PASS: CI=true npm run test:e2e on Node 22.20.0 — all 4 scenarios passed in the final invocation. Earlier default-policy runs intermittently failed unchanged Kids feedback and onboarding Accounts assertions; these are not hidden or counted as passing invocations. No Kids or onboarding implementation/assertions were edited.
- PASS: npm run build.
- The new HTTP fixture uses the existing native ESM verification helper to avoid a Node 22 Playwright Auth-import conflict. No application behavior was changed for that fixture issue.
- An initial parallel npm test run timed out in two unchanged form-rendering tests. No form code or unrelated assertions were changed.
- NOT RUN: Python tests, real microphone/desktop/mobile acoustic acceptance and live OpenAI checks. Those implementations are outside this backend phase.

## Limitations

Voice/UI confirmation integration, the desktop companion and secure desktop enrollment/App Check, cloud Notes migration, mobile voice work and the remaining production-readiness roadmap are not implemented here. English server summaries accompany typed canonical actions for future localized previews. Existing clients continue their current explicit-review protections.

## Manual QA

See docs/JARVIS_ACTIONS.md for contracts, emulator setup, errors, retention and rollback. Against demo emulators: prepare an expense using real account/category IDs and verify no financial/audit write; confirm twice/concurrently and verify one entity, one audit and correct balance/monthly totals. Test cancellation, expiry, another user/session, membership removal and stale task versions. Verify recurring completion and rescheduling through existing UI flows.

**Production was not deployed. No production data was deleted, no security controls were weakened, and this PR must not be merged automatically.**
