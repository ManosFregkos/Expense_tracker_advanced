import {
  FieldValue,
  type Firestore,
  type Transaction as FirestoreTransaction,
} from 'firebase-admin/firestore'
import type { AuditAction } from '@family-expense-tracker/shared'

export interface AuditInput {
  householdId: string
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export function writeAudit(
  firestore: Firestore,
  transaction: FirestoreTransaction,
  input: AuditInput,
): void {
  const ref = firestore.collection(`households/${input.householdId}/auditLogs`).doc()
  transaction.set(ref, {
    id: ref.id,
    householdId: input.householdId,
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    timestamp: FieldValue.serverTimestamp(),
    ...(input.before || input.after
      ? {
          changes: {
            ...(input.before ? { before: input.before } : {}),
            ...(input.after ? { after: input.after } : {}),
          },
        }
      : {}),
  })
}

export function safeFinancialSnapshot(value: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...value }
  delete safe.searchPrefixes
  return safe
}
