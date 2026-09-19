import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() })
const db = getFirestore(app)
let changes = 0

for (const household of (await db.collection('households').get()).docs) {
  for (const account of (await household.ref.collection('accounts').get()).docs) {
    if (account.get('appCalculatedBalanceMinor') === undefined) {
      changes += 1
      if (apply)
        await account.ref.update({
          appCalculatedBalanceMinor: account.get('currentBalanceMinor'),
          updatedAt: Timestamp.now(),
        })
    }
  }
  for (const category of (await household.ref.collection('categories').get()).docs) {
    const name = String(category.get('name') ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
    const update = {
      ...(category.get('normalizedName') === undefined ? { normalizedName: name } : {}),
      ...(category.get('origin') === undefined
        ? { origin: category.get('isSystem') ? 'SYSTEM' : 'CUSTOM' }
        : {}),
      ...(category.get('createdAt') === undefined ? { createdAt: Timestamp.now() } : {}),
      ...(category.get('updatedAt') === undefined ? { updatedAt: Timestamp.now() } : {}),
    }
    if (Object.keys(update).length) {
      changes += 1
      if (apply) await category.ref.update(update)
    }
  }
  for (const transaction of (await household.ref.collection('transactions').get()).docs) {
    const splits = transaction.get('splits')
    if (
      Array.isArray(splits) &&
      splits.length > 0 &&
      transaction.get('splitCategoryIds') === undefined
    ) {
      const splitCategoryIds = [
        ...new Set(
          splits.flatMap((split) =>
            split && typeof split === 'object' && typeof split.categoryId === 'string'
              ? [split.categoryId]
              : [],
          ),
        ),
      ]
      if (splitCategoryIds.length) {
        changes += 1
        if (apply) await transaction.ref.update({ splitCategoryIds, updatedAt: Timestamp.now() })
      }
    }
  }
  for (const connection of (await household.ref.collection('bankConnections').get()).docs) {
    const providerConnectionId = connection.get('providerConnectionId')
    const institutionName = String(
      connection.get('institutionName') ?? connection.get('institutionId') ?? '',
    ).toLowerCase()
    const institutionCode = institutionName.includes('alpha')
      ? 'ALPHA_BANK'
      : institutionName.includes('eurobank')
        ? 'EUROBANK'
        : institutionName.includes('national') || institutionName.includes('nbg')
          ? 'NBG'
          : undefined
    if (institutionCode && connection.get('institutionCode') === undefined) {
      changes += 1
      if (apply) await connection.ref.update({ institutionCode, updatedAt: Timestamp.now() })
    }
    if (providerConnectionId) {
      changes += 1
      if (apply) {
        await db.doc(`privateBankConnections/${connection.id}`).set(
          {
            householdId: household.id,
            ownerUserId: connection.get('ownerUserId'),
            providerCustomerId: connection.get('providerCustomerId') ?? 'MIGRATION_REQUIRED',
            providerConnectionId,
            migratedAt: Timestamp.now(),
          },
          { merge: true },
        )
        await connection.ref.update({
          providerConnectionId: FieldValue.delete(),
          providerCustomerId: FieldValue.delete(),
          status:
            connection.get('status') === 'EXPIRED' ? 'REQUIRES_REAUTH' : connection.get('status'),
          consentStatus: connection.get('status') === 'EXPIRED' ? 'EXPIRED' : 'UNKNOWN',
          updatedAt: Timestamp.now(),
        })
      }
    }
  }
}

console.info(
  `${apply ? 'Applied' : 'Would apply'} ${changes} backwards-compatible document updates.`,
)
if (!apply)
  console.info('Re-run with --apply after taking a Firestore backup and reviewing this dry run.')
