# Security notes

Firestore Rules are defense in depth for direct reads. Financial writes, membership changes, invitations, audit logs, bank imports, and analytics go through trusted Functions. Rules use membership-document existence and role checks; knowing a household ID is never sufficient.

Callable functions require Firebase Auth. Sensitive workflows additionally require verified email. All payloads are size/shape constrained by Zod, and actor/household/owner relationships are loaded from Firestore. Audit snapshots exclude secrets. Production should apply per-user/IP quotas at the edge for invitation and import endpoints and alert on repeated authorization failures.

Bank provider access tokens belong only in a provider-managed vault or Secret Manager; Firestore stores opaque provider connection IDs and status. Never log access tokens, credentials, raw authorization callbacks, or invitation acceptance material.
