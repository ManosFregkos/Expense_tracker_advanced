# Architecture

## Boundaries

`packages/shared` is pure TypeScript and owns serializable domain contracts, validation, constants, and deterministic calculations. `functions` owns trust boundaries, authorization, audit records, aggregate/balance caches, invitations, import idempotency, and provider secrets. `apps/web` owns presentation and read repositories; financial writes use callable Functions.

Firestore is household-centric. URLs and client state may select a household, but authorization always resolves membership from Firestore. React Query owns remote state and narrowly scoped invalidation; only authentication/active-household UI state uses React context.

## Mutation flow

1. React Hook Form validates shared Zod input.
2. A typed callable client sends only mutation input.
3. Function authenticates, parses again, and checks membership/role.
4. A Firestore transaction applies document, account-balance, monthly-aggregate, and audit changes together.
5. The client invalidates only affected account, transaction, and analytics query keys.

## Search and pagination

Transactions store server-derived `searchPrefixes` from normalized merchant and description tokens. Repository cursors use the last document snapshot, never numeric offsets. `TransactionSearchProvider` keeps an external full-text engine replaceable later.

## Dates

Source timestamps are UTC. Month keys are derived in an explicit IANA timezone. Callable input uses ISO strings; Functions convert them to Firestore timestamps. UI display uses `Intl.DateTimeFormat` and user locale.

Task date-only values additionally store a `yyyy-MM-dd` household-local key. Their query deadline
is the final millisecond before the next local day; timed tasks convert the selected wall-clock
time through the household IANA timezone. This prevents UTC midnight and DST changes from moving a
task to another Today group.

## Household tasks

Tasks, lists, subtasks, and user-facing activity are household collections. Direct writes are
denied; callable Functions revalidate membership, assignee, list, task version, and task state in a
Firestore transaction. `version` provides optimistic concurrency for edits and reorder anchors.

Recurring tasks are occurrence documents rather than a mutable due date. Completion atomically
closes the current occurrence and creates a deterministic `{seriesId}__occurrence_{number}` next
document. A retry sees the closed occurrence and cannot duplicate the next one. Reopening removes a
pristine generated next occurrence; if later activity exists, reopening is rejected rather than
silently losing work.

Reminder workers claim deterministic backend-only delivery records before creating a user in-app
notification. Notification-created triggers claim a second push-delivery record before FCM. This
provides at-most-once push attempts and duplicate-callback protection; the in-app notification is
the durable source when a push transport attempt fails.

## Open Banking boundary

Only Functions instantiate `OpenBankingProvider`. Public connection documents contain display/status metadata; `/privateBankConnections` contains provider customer/connection identifiers and is denied by Firestore Rules. Salt Edge Connect/Reconnect URLs are created server-side. Signed callbacks create deterministic queue events, and a Firestore trigger runs the same sync pipeline used by manual and scheduled refreshes.

Each sync takes a recoverable ten-minute lease on the public connection document. Provider transaction documents use a hash of application connection ID and provider transaction ID. A second fingerprint and scored candidate search handle pending IDs that change when booked and manual entries that precede bank import. Equal high-scoring candidates go to review rather than being guessed.

Initial imported history participates in analytics but is marked `affectsBalance: false`, because the newly created account's opening application balance is anchored to the bank's current/outstanding balance. Transactions arriving after that anchor affect the application balance. Bank-reported values remain separate and are snapshotted after successful sync.

Credit-card application balance means outstanding debt: purchases increase it, refunds and transfers into the card reduce it. A card payment is one transfer and never an expense.
