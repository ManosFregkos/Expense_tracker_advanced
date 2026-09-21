# Security notes

Firestore Rules are defense in depth for direct reads. Financial writes, membership changes, invitations, audit logs, bank imports, and analytics go through trusted Functions. Rules use membership-document existence and role checks; knowing a household ID is never sufficient.

Callable functions require Firebase Auth. Sensitive workflows additionally require verified email. All payloads are size/shape constrained by Zod, and actor/household/owner relationships are loaded from Firestore. Audit snapshots exclude secrets. Production should enable App Check enforcement after monitoring, apply per-user/IP quotas at the edge for invitation and import endpoints, and alert on repeated authorization failures.

Bank provider access tokens belong only in a provider-managed vault or Secret Manager; Firestore stores opaque provider connection IDs and status. Never log access tokens, credentials, raw authorization callbacks, or invitation acceptance material.

Salt Edge app credentials are Firebase Secret Manager parameters attached only to banking Functions. Callback authenticity uses the Salt Edge V6 RSA signature over the exact configured callback URL and raw request bytes; event hashes reject replay. Return URLs are restricted to configured origins. Raw provider payloads are discarded after normalization, retaining only a SHA-256 payload hash where supplied.

Bank connection mutation callables derive the actor from Firebase Auth, require household owner/admin membership, and resolve the private connection by both application connection ID and stored household ID. Direct client writes to connections, raw bank records, account links, snapshots, queues, and private mappings are denied.

Task documents follow the same trust boundary as financial mutations. Callable handlers re-read
the actor membership inside the transaction and resolve assignees, lists, and optional transaction
references beneath the selected household path. Slash-containing document IDs are rejected.
Cross-household IDs therefore cannot escape or reference another household. Task/list/subtask and
activity writes, notification delivery claims, and device tokens are denied to clients.

Task audit snapshots exclude descriptions and reminder/device data. User-facing task activity is a
separate member-readable collection. Device tokens and delivery state are backend-only; token
ownership is reassigned atomically when the same browser token registers for a different user.
