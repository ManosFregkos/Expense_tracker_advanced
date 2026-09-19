# Firestore data model

Every financial document is scoped beneath a household. IDs sent by clients are treated only as lookup input; callable Functions resolve membership and related documents before writing.

| Path                                                            | Purpose                                                                             | Client access                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `/users/{uid}`                                                  | Minimal profile: email, display name, photo URL, locale, timestamps                 | Own user only                                      |
| `/households/{householdId}`                                     | Name, reporting currency, timezone, creator, timestamps                             | Member read; Function write                        |
| `/households/{householdId}/members/{uid}`                       | Role and household display identity                                                 | Member read; Function write                        |
| `/households/{householdId}/accounts/{accountId}`                | Owner, type, currency, opening and cached current balance                           | Member read; Function write                        |
| `/households/{householdId}/transactions/{transactionId}`        | Expense, income, or one-document transfer; source, search prefixes, deletion fields | Member read; Function write                        |
| `/households/{householdId}/categories/{categoryId}`             | Hierarchical system/custom categories                                               | Member read; Function write                        |
| `/households/{householdId}/monthlyAnalytics/{yyyy-MM}`          | Cashflow and expense dimension aggregates                                           | Member read; backend write                         |
| `/households/{householdId}/bankConnections/{connectionId}`      | Opaque provider connection metadata, never tokens                                   | Admin/owner read; backend write                    |
| `/households/{householdId}/bankTransactions/{hash}`             | Idempotent raw imported transactions                                                | Member read; backend write                         |
| `/households/{householdId}/merchantRules/{ruleId}`              | Deterministic categorization rules                                                  | Member read; Function write                        |
| `/households/{householdId}/bankAccountLinks/{linkId}`           | Provider-account to financial-account mapping and safe masked identifiers           | Member read; backend write                         |
| `/households/{householdId}/accounts/{id}/balanceSnapshots/{id}` | Lightweight post-sync bank/application comparisons                                  | Member read; backend write                         |
| `/privateBankConnections/{connectionId}`                        | Provider customer and connection identifiers                                        | Backend only                                       |
| `/privateOpenBankingCustomers/{uid}`                            | Provider customer mapping                                                           | Backend only                                       |
| `/openBankingWebhookEvents/{eventHash}`                         | Replay-safe callback work queue                                                     | Backend only                                       |
| `/households/{householdId}/auditLogs/{logId}`                   | Actor, action, entity, safe before/after snapshot                                   | Admin/owner read; backend write                    |
| `/invitations/{invitationId}`                                   | Email-bound, expiring membership invitation                                         | Recipient or household member read; Function write |

The specification’s illustrative `analytics/monthly/{yyyyMM}` path has an odd number of Firestore path segments and therefore cannot identify a document. `monthlyAnalytics/{yyyy-MM}` is the valid household subcollection equivalent.

## Transaction query fields

`isDeleted` is a server-owned query flag paired with authoritative `deletedAt` and `deletedBy` fields. All normal list queries require `isDeleted == false`. `searchPrefixes` contains bounded, normalized token prefixes derived on the server from description and merchant. Pagination uses `transactionDate desc` plus Firestore document cursors. Composite indexes cover type, account, member, category, and prefix filtering.

## Aggregate consistency

The transaction mutation reads the household timezone, related accounts/category/member, affected aggregate months, and all affected account documents before writing. It then commits transaction data, account increments, aggregate replacement documents, and the audit record in one Firestore transaction. Updates reverse the old effects and apply the new effects; crossing a month boundary touches both months. Delete reverses effects and restore reapplies them.

`rebuildMonthlyAnalytics` is an administrator repair path that regenerates every month from transaction source documents. It deliberately does not make raw bank transactions part of normalized analytics until they have been converted into an application transaction.

Pending bank records remain in `bankTransactions` activity but do not create normalized analytics transactions. Booked records create or link exactly one transaction. Splits replace the parent category dimension, never the parent amount, so totals are counted once.
