# Security notes

Firestore Rules are defense in depth for direct reads. Financial writes, membership changes, invitations, audit logs, and analytics go through trusted Functions. Rules use membership-document existence and role checks; knowing a household ID is never sufficient.

Callable functions require Firebase Auth. Sensitive workflows additionally require verified email. All payloads are size/shape constrained by Zod, and actor/household/owner relationships are loaded from Firestore. Audit snapshots exclude secrets. Production should enable App Check enforcement after monitoring, apply per-user/IP quotas at the edge for invitation and import endpoints, and alert on repeated authorization failures.

Bank provider access tokens belong only in a provider-managed vault or Secret Manager; Firestore stores opaque provider connection IDs and status. Never log access tokens, credentials, raw authorization callbacks, or invitation acceptance material.

Retired bank collections and private provider metadata are denied by the default Firestore rule. No banking callable Functions, webhooks, or scheduled refresh workers remain in the deployment source.

Task documents follow the same trust boundary as financial mutations. Callable handlers re-read
the actor membership inside the transaction and resolve assignees, lists, and optional transaction
references beneath the selected household path. Slash-containing document IDs are rejected.
Cross-household IDs therefore cannot escape or reference another household. Task/list/subtask and
activity writes, notification delivery claims, and device tokens are denied to clients.

Task audit snapshots exclude descriptions and reminder/device data. User-facing task activity is a
separate member-readable collection. Device tokens and delivery state are backend-only; token
ownership is reassigned atomically when the same browser token registers for a different user.
