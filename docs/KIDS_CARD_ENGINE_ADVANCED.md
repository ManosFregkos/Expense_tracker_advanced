# Kids Card Engine — Advanced extension

## Compatibility

This release is additive. Existing Part 1 child profiles, sessions, attempts, progress documents, routes,
and canonical system card IDs remain valid. System content is bundled with `contentVersion: 2`; no system
content is copied to Firestore.

Existing progress documents are upgraded lazily by `persistKidsAttempt`. Missing
`consecutiveSuccesses`, `recentMisses`, `lastCorrectAt`, and `nextSuggestedAt` fields use safe
defaults and are written on the next attempt. Existing Kids settings similarly acquire per-mode
difficulty state on the next attempt. No offline or batch migration is required.

## New household collections

- `kidsCustomDecks`
- `kidsCustomCards`
- `kidsRelationships`
- `kidsEverydayScenarios`
- `kidsSequences`
- `kidsEmotionScenarios`
- `kidsAssets` (reserved metadata namespace)

All mutations use callable Functions. Firestore clients have household-member read access and no direct
write access. Custom documents retain stable IDs and are archived with `enabled: false` and
`archivedAt`.

## Media

Images are stored at `kids/{householdId}/cards/{assetId}`. The client checks extension, MIME type,
magic bytes, a 5 MB limit, and a 4096 px dimension limit before upload. Storage Rules repeat household
role, MIME, size, and ownership checks. Deletion is intentionally disabled so historical content cannot
lose a referenced asset. Missing or offline media renders a safe placeholder.

## Deployment

1. Deploy Firestore Rules and `storage.rules`.
2. Deploy Functions, including `saveKidsCustomContent` and `archiveKidsCustomContent`.
3. Deploy the web application.
4. No document rewrite or index creation is required by the current query set.
