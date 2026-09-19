import { createHash, randomUUID } from 'node:crypto'
import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { db } from '../firebase.js'
import { getOpenBankingProvider } from './provider-factory.js'
import { syncBankConnectionInternal } from '../services/banking.js'
import { openBankingCredentialSecrets, openBankingSecrets } from './secrets.js'

type CallbackBody = {
  data?: {
    connection_id?: unknown
    customer_id?: unknown
    custom_fields?: unknown
    stage?: unknown
    error_class?: unknown
    consent_status?: unknown
  }
  meta?: { time?: unknown }
}

export const openBankingWebhook = onRequest(
  { region: 'europe-west1', cors: false, secrets: openBankingCredentialSecrets },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed')
      return
    }
    const signature = request.get('signature') ?? ''
    const signatureKeyVersion = request.get('signature-key-version') ?? undefined
    const callbackUrl = process.env.OPEN_BANKING_WEBHOOK_URL
    if (!callbackUrl || !signature) {
      response.status(401).send('Invalid callback')
      return
    }
    const rawBody = request.rawBody
    if (
      !(await getOpenBankingProvider().verifyWebhook({
        callbackUrl,
        rawBody,
        signature,
        ...(signatureKeyVersion ? { signatureKeyVersion } : {}),
      }))
    ) {
      response.status(401).send('Invalid callback')
      return
    }
    const body = request.body as CallbackBody
    const data = body?.data ?? {}
    const connectionId = typeof data?.connection_id === 'string' ? data.connection_id : ''
    const customerId = typeof data?.customer_id === 'string' ? data.customer_id : ''
    const customFields =
      data?.custom_fields &&
      typeof data.custom_fields === 'object' &&
      !Array.isArray(data.custom_fields)
        ? (data.custom_fields as Record<string, unknown>)
        : {}
    const appConnectionId =
      typeof customFields.appConnectionId === 'string' ? customFields.appConnectionId : ''
    const callbackHouseholdId =
      typeof customFields.householdId === 'string' ? customFields.householdId : ''
    if (!connectionId || !customerId || !appConnectionId || !callbackHouseholdId) {
      response.status(400).send('Malformed callback')
      return
    }
    const privateRef = db.doc(`privateBankConnections/${appConnectionId}`)
    const privateSnapshot = await privateRef.get()
    if (
      !privateSnapshot.exists ||
      privateSnapshot.get('providerCustomerId') !== customerId ||
      privateSnapshot.get('householdId') !== callbackHouseholdId
    ) {
      response.status(202).send('Accepted')
      return
    }
    const householdId = String(privateSnapshot.get('householdId'))
    const connectionRef = db.doc(`households/${householdId}/bankConnections/${appConnectionId}`)
    await privateRef.update({ providerConnectionId: connectionId, updatedAt: Timestamp.now() })
    const consentStatus =
      typeof data.consent_status === 'string' ? data.consent_status.toUpperCase() : ''
    if (['EXPIRED', 'REVOKED'].includes(consentStatus)) {
      await connectionRef.update({
        consentStatus,
        status: 'REQUIRES_REAUTH',
        updatedAt: Timestamp.now(),
      })
      response.status(202).send('Accepted')
      return
    }
    const errorClass = typeof data.error_class === 'string' ? data.error_class : ''
    if (errorClass) {
      const requiresReauth = ['InvalidCredentials', 'ConsentExpired', 'ConsentRevoked'].includes(
        errorClass,
      )
      await connectionRef.update({
        status: requiresReauth ? 'REQUIRES_REAUTH' : 'ERROR',
        ...(requiresReauth ? { consentStatus: 'EXPIRED' } : {}),
        lastErrorCode: requiresReauth ? errorClass : 'PROVIDER_CALLBACK_FAILURE',
        lastErrorMessageSafe: requiresReauth
          ? 'Bank authorization has expired. Reconnect to continue.'
          : 'The bank is temporarily unavailable. Your previous data is safe.',
        updatedAt: Timestamp.now(),
      })
      response.status(202).send('Accepted')
      return
    }
    if (data.stage !== 'finish') {
      response.status(202).send('Accepted')
      return
    }
    const replayId = createHash('sha256')
      .update(signature)
      .update('\u0000')
      .update(rawBody)
      .digest('hex')
    try {
      await db.doc(`openBankingWebhookEvents/${replayId}`).create({
        id: replayId,
        appConnectionId,
        householdId,
        providerConnectionId: connectionId,
        status: 'PENDING',
        correlationId: randomUUID(),
        receivedAt: Timestamp.now(),
      })
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('ALREADY_EXISTS')) throw error
    }
    response.status(202).send('Accepted')
  },
)

export const processOpenBankingWebhook = onDocumentCreated(
  {
    document: 'openBankingWebhookEvents/{eventId}',
    region: 'europe-west1',
    retry: true,
    secrets: openBankingSecrets,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return
    const data = snapshot.data()
    if (data.status !== 'PENDING') return
    await snapshot.ref.update({ status: 'PROCESSING', startedAt: Timestamp.now() })
    try {
      await syncBankConnectionInternal(
        String(data.householdId),
        String(data.appConnectionId),
        false,
      )
      await snapshot.ref.update({ status: 'PROCESSED', processedAt: Timestamp.now() })
    } catch (error) {
      if (error instanceof HttpsError && error.code === 'already-exists') {
        await snapshot.ref.update({
          status: 'PENDING',
          lastAttemptAt: Timestamp.now(),
          retryReason: 'SYNC_LOCKED',
        })
        throw error
      }
      await snapshot.ref.update({
        status: 'ERROR',
        processedAt: Timestamp.now(),
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
      })
    }
  },
)

export const scheduledBankRefresh = onSchedule(
  {
    schedule: 'every 30 minutes',
    region: 'europe-west1',
    timeZone: 'UTC',
    retryCount: 0,
    secrets: openBankingSecrets,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const cursorRef = db.doc('_system/openBankingRefreshScheduler')
    const cursorSnapshot = await cursorRef.get()
    const cursor = cursorSnapshot.get('cursor') as string | undefined
    const baseQuery = db
      .collectionGroup('bankConnections')
      .where('status', 'in', ['ACTIVE', 'SYNCING', 'STALE', 'ERROR'])
      .orderBy(FieldPath.documentId())
      .limit(100)
    let snapshot = await (cursor ? baseQuery.startAfter(cursor) : baseQuery).get()
    if (snapshot.empty && cursor) snapshot = await baseQuery.get()
    const now = Date.now()
    for (const connection of snapshot.docs) {
      const next = connection.get('nextRefreshPossibleAt') as Timestamp | undefined
      const last = connection.get('lastSuccessfulSyncAt') as Timestamp | undefined
      if ((next?.toMillis() ?? 0) > now || now - (last?.toMillis() ?? 0) < 6 * 60 * 60_000) continue
      const householdId = connection.ref.parent.parent?.id
      if (!householdId) continue
      try {
        await syncBankConnectionInternal(householdId, connection.id, true)
      } catch {
        /* status and safe error are persisted by the pipeline */
      }
    }
    const last = snapshot.docs.at(-1)
    await cursorRef.set(
      {
        cursor: snapshot.size === 100 && last ? last.ref.path : null,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )
  },
)
