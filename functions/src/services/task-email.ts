import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { defineSecret, defineString } from 'firebase-functions/params'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import type { TaskNotification } from '@family-expense-tracker/shared'
import { adminAuth, db } from '../firebase.js'

const resendApiKey = defineSecret('RESEND_API_KEY')
const emailFrom = defineString('TASK_EMAIL_FROM')

export const sendTaskReminderEmail = onDocumentCreated(
  {
    document: 'users/{userId}/taskNotifications/{notificationId}',
    region: 'europe-west1',
    secrets: [resendApiKey],
    retry: true,
  },
  async (event) => {
    const notification = event.data?.data() as TaskNotification | undefined
    if (!notification?.emailRequested || !['DUE', 'OVERDUE'].includes(notification.type)) return

    const { userId, notificationId } = event.params
    const deliveryRef = db.doc(`privateTaskEmailDeliveries/${userId}_${notificationId}`)
    const claim = await db.runTransaction(async (transaction) => {
      const delivery = await transaction.get(deliveryRef)
      if (delivery.get('status') === 'SENT' || delivery.get('status') === 'SKIPPED') return 'DONE'
      const previousClaim = delivery.get('claimedAt') as Timestamp | undefined
      if (
        delivery.get('status') === 'CLAIMED' &&
        previousClaim &&
        Date.now() - previousClaim.toMillis() < 120_000
      )
        return 'BUSY'
      transaction.set(deliveryRef, {
        userId,
        notificationId,
        status: 'CLAIMED',
        claimedAt: Timestamp.now(),
      })
      return 'CLAIMED'
    })
    if (claim === 'DONE') return
    if (claim === 'BUSY') throw new Error('Email delivery is already in progress.')

    try {
      if (event.time && Date.now() - Date.parse(event.time) > 86_400_000) {
        await deliveryRef.update({ status: 'SKIPPED', reason: 'REMINDER_EXPIRED' })
        return
      }
      const user = await adminAuth.getUser(userId)
      if (!user.email || !user.emailVerified) {
        await deliveryRef.update({ status: 'SKIPPED', reason: 'NO_VERIFIED_EMAIL' })
        return
      }
      if (process.env.FUNCTIONS_EMULATOR === 'true') {
        console.info('Mock task email delivery', { userId, notificationId })
        await deliveryRef.update({
          status: 'SENT',
          mock: true,
          completedAt: FieldValue.serverTimestamp(),
        })
        return
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey.value()}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `task-reminder/${userId}/${notificationId}`,
        },
        body: JSON.stringify({
          from: emailFrom.value(),
          to: [user.email],
          subject: notification.title,
          text: `${notification.body}\n\nOpen the expense tracker to view your task.`,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) {
        if (
          response.status >= 400 &&
          response.status < 500 &&
          ![409, 429].includes(response.status)
        ) {
          await deliveryRef.update({
            status: 'SKIPPED',
            reason: `RESEND_HTTP_${response.status}`,
            completedAt: FieldValue.serverTimestamp(),
          })
          return
        }
        throw new Error(`Resend returned HTTP ${response.status}`)
      }
      const result = (await response.json()) as { id?: string }
      await deliveryRef.update({
        status: 'SENT',
        providerId: result.id ?? null,
        completedAt: FieldValue.serverTimestamp(),
      })
    } catch (error) {
      await deliveryRef.update({
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown email delivery error',
        completedAt: FieldValue.serverTimestamp(),
      })
      throw error
    }
  },
)
