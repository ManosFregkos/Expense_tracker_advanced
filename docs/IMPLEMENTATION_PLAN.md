# Implementation plan

The phases mirror the product specification. Each phase is completed with typecheck, lint, relevant tests, and a short change log before the next phase begins.

| Phase | Scope                                                                            | Status   |
| ----- | -------------------------------------------------------------------------------- | -------- |
| 1     | Workspaces, React/Vite, Firebase configuration, Mantine, routing, shared package | Complete |
| 2     | Authentication, protected routes, user profile                                   | Complete |
| 3     | Household, members, onboarding, default categories                               | Complete |
| 4     | Accounts, cash, account UI                                                       | Complete |
| 5     | Expense, income, transfer mutations and validation                               | Complete |
| 6     | Transaction search, filtering, pagination, details                               | Complete |
| 7     | Dashboard, aggregates, charts, analytics                                         | Complete |
| 8     | Invitations, members, roles                                                      | Complete |
| 9     | Audit logging, rules, App Check                                                  | Complete |
| 10    | PWA, offline and responsive polish                                               | Complete |
| 11    | CSV export                                                                       | Complete |
| 12    | Bank/provider architecture, idempotency, merchant rules                          | Complete |
| 13    | Unit, component, rules, E2E, CI and final documentation                          | Complete |

## Checkpoint summary

- Phase 1–3: workspace tooling, shared Zod/domain boundary, Firebase client/emulators, authentication, verification gate, protected routes, household onboarding, and category seeding.
- Phase 4–6: individually owned accounts, cached/deterministic balances, unified transaction form, atomic transfers, soft deletion, normalized prefix search, URL filters, and cursor pagination.
- Phase 7–9: dashboard/report charts, monthly aggregates and repair callable, invitations, role checks, audit records, deny-by-default rules, App Check initialization, and household-isolation tests.
- Phase 10–13: installable/offline PWA shell, responsive navigation, CSV ownership export, bank-provider abstraction/mock/idempotency, unit/component/E2E coverage, CI, and operational documentation.

## Quality gates

Every financial mutation is server-validated and authorized. Money remains integer minor units. A transfer is one atomic domain record and excluded from cashflow. Soft-deleted transactions are excluded from reads and aggregates. Aggregate deltas handle amount, dimension, and month changes. Rules tests prove household isolation. The final gate requires install, typecheck, lint, tests, Functions build, web build, rules tests, and emulator-backed E2E where the environment supports it.
