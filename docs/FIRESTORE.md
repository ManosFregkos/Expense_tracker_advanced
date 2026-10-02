# Firestore data model

Every financial document is scoped beneath a household. IDs sent by clients are treated only as lookup input; callable Functions resolve membership and related documents before writing.

| Path                                                            | Purpose                                                                             | Client access                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `/users/{uid}`                                                  | Minimal profile: email, display name, photo URL, locale, timestamps                 | Own user only                                      |
| `/households/{householdId}`                                     | Name, reporting currency, timezone, creator, timestamps                             | Member read; Function write                        |
| `/households/{householdId}/members/{uid}`                       | Role and household display identity                                                 | Member read; Function write                        |
| `/households/{householdId}/accounts/{accountId}`                | Owner, type, currency, opening and cached current balance                           | Member read; Function write                        |
| `/households/{householdId}/transactions/{transactionId}`        | Expense or income; source, search prefixes, deletion fields | Member read; Function write                        |
| `/households/{householdId}/categories/{categoryId}`             | Hierarchical system/custom categories                                               | Member read; Function write                        |
| `/households/{householdId}/monthlyAnalytics/{yyyy-MM}`          | Cashflow and expense dimension aggregates                                           | Member read; backend write                         |
| `/households/{householdId}/auditLogs/{logId}`                   | Actor, action, entity, safe before/after snapshot                                   | Admin/owner read; backend write                    |
| `/invitations/{invitationId}`                                   | Email-bound, expiring membership invitation                                         | Recipient or household member read; Function write |
| `/households/{householdId}/tasks/{taskId}`                      | Task occurrence, due/reminder state, soft deletion, concurrency version             | Member read when active; Function write            |
| `/households/{householdId}/tasks/{taskId}/subtasks/{subtaskId}` | Checklist items; completion does not implicitly complete the parent                 | Member read when parent active; Function write     |
| `/households/{householdId}/taskLists/{listId}`                  | Lightweight household task organization                                             | Member read; Function write                        |
| `/households/{householdId}/taskActivity/{activityId}`           | User-facing task history with bounded safe metadata                                 | Member read; Function write                        |
| `/users/{uid}/taskNotificationSettings/{householdId}`           | Conservative reminder/assignment preferences                                        | Own user read; Function write                      |
| `/users/{uid}/taskNotifications/{notificationId}`               | Durable in-app task notifications                                                   | Own user read; Function write                      |
| `/userDevices/{uid}/devices/{tokenHash}`                        | Backend-only FCM tokens for multiple devices                                        | Backend only                                       |
| `/privateTaskReminderDeliveries/{deliveryId}`                   | Idempotent scheduled reminder claims                                                | Backend only                                       |
| `/privateTaskPushDeliveries/{deliveryId}`                       | Idempotent FCM trigger claims                                                       | Backend only                                       |
| `/privateTaskEmailDeliveries/{deliveryId}`                      | Idempotent email trigger claims                                                     | Backend only                                       |

Completed tasks are retained and paginated by `updatedAt`; normal task queries always include
`isDeleted == false`. Soft-deleted documents cannot be fetched directly by clients. Composite
indexes cover active due/manual views, assignee/list dimensions, completed history, search, task
activity, and collection-group reminder scheduling.

The specification’s illustrative `analytics/monthly/{yyyyMM}` path has an odd number of Firestore path segments and therefore cannot identify a document. `monthlyAnalytics/{yyyy-MM}` is the valid household subcollection equivalent.

## Transaction query fields

`isDeleted` is a server-owned query flag paired with authoritative `deletedAt` and `deletedBy` fields. All normal list queries require `isDeleted == false`. `searchPrefixes` contains bounded, normalized token prefixes derived on the server from description and merchant. Pagination uses `transactionDate desc` plus Firestore document cursors. Composite indexes cover type, account, member, category, and prefix filtering.

## Aggregate consistency

The transaction mutation reads the household timezone, related accounts/category/member, affected aggregate months, and all affected account documents before writing. It then commits transaction data, account increments, aggregate replacement documents, and the audit record in one Firestore transaction. Updates reverse the old effects and apply the new effects; crossing a month boundary touches both months. Delete reverses effects and restore reapplies them.

`rebuildMonthlyAnalytics` is an administrator repair path that regenerates every month from transaction source documents.

Splits replace the parent category dimension, never the parent amount, so totals are counted once.
