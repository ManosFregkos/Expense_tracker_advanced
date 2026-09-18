import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { householdIdSchema, processBankTransactionSchema } from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { db } from '../firebase.js'
import { writeAudit } from './audit.js'
import { requireMember } from './permissions.js'

export function bankTransactionDocumentId(
  connectionId: string,
  externalTransactionId: string,
): string {
  return createHash('sha256').update(`${connectionId}\u0000${externalTransactionId}`).digest('hex')
}

export const syncBankConnection = secureCallable(householdIdSchema, async (input, actor) => {
  await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
  throw new HttpsError(
    'failed-precondition',
    'Configure a regulated PSD2 provider before enabling live synchronization.',
  )
})

export const processBankTransaction = secureCallable(
  processBankTransactionSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid, ['OWNER', 'ADMIN'])
    const [connection, account] = await Promise.all([
      db.doc(`households/${input.householdId}/bankConnections/${input.bankConnectionId}`).get(),
      db.doc(`households/${input.householdId}/accounts/${input.accountId}`).get(),
    ])
    if (!connection.exists || !account.exists)
      throw new HttpsError('failed-precondition', 'Bank connection or account was not found.')
    const id = bankTransactionDocumentId(input.bankConnectionId, input.externalTransactionId)
    const ref = db.doc(`households/${input.householdId}/bankTransactions/${id}`)
    let created = false
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref)
      if (existing.exists) return
      created = true
      const document = {
        id,
        householdId: input.householdId,
        bankConnectionId: input.bankConnectionId,
        externalTransactionId: input.externalTransactionId,
        accountId: input.accountId,
        rawDescription: input.rawDescription,
        amountMinor: input.amountMinor,
        currency: input.currency,
        bookingDate: Timestamp.fromDate(new Date(input.bookingDate)),
        status: input.status,
        processingStatus: 'UNPROCESSED',
        createdAt: Timestamp.now(),
      }
      transaction.set(ref, document)
      writeAudit(db, transaction, {
        householdId: input.householdId,
        userId: actor.uid,
        action: 'PROCESS_BANK_TRANSACTION',
        entityType: 'BANK_TRANSACTION',
        entityId: id,
        after: {
          externalTransactionId: input.externalTransactionId,
          accountId: input.accountId,
          status: input.status,
        },
      })
    })
    return { bankTransactionId: id, created }
  },
)
