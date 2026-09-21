import { createHash } from 'node:crypto'
import { FieldValue, Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { BatchResponse } from 'firebase-admin/messaging'
import { HttpsError } from 'firebase-functions/v2/https'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import {
  notificationSettingsSchema,
  registerDeviceTokenSchema,
  taskNotificationIdSchema,
  type HouseholdTask,
  type TaskNotification,
} from '@family-expense-tracker/shared'
import { secureCallable } from '../callable.js'
import { adminMessaging, db } from '../firebase.js'
import { writeAudit } from './audit.js'
import { requireMember } from './permissions.js'

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function storedIso(value: HouseholdTask['dueAt']): string {
  if (!value) return ''
  return (value instanceof Date ? value : value.toDate()).toISOString()
}

export const registerDeviceToken = secureCallable(
  registerDeviceTokenSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid)
    const id = digest(input.token)
    const deviceRef = db.doc(`userDevices/${actor.uid}/devices/${id}`)
    const ownershipRef = db.doc(`privateDeviceTokenOwners/${id}`)
    await db.runTransaction(async (transaction) => {
      const ownership = await transaction.get(ownershipRef)
      const previousUserId = ownership.get('userId') as string | undefined
      if (previousUserId && previousUserId !== actor.uid)
        transaction.delete(db.doc(`userDevices/${previousUserId}/devices/${id}`))
      transaction.set(
        deviceRef,
        {
          id,
          userId: actor.uid,
          fcmToken: input.token,
          platform: input.platform,
          createdAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      transaction.set(ownershipRef, {
        deviceId: id,
        userId: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    return { deviceId: id }
  },
)

export const updateTaskNotificationSettings = secureCallable(
  notificationSettingsSchema,
  async (input, actor) => {
    await requireMember(input.householdId, actor.uid)
    await db.doc(`users/${actor.uid}/taskNotificationSettings/${input.householdId}`).set({
      householdId: input.householdId,
      dueReminders: input.dueReminders,
      assignmentNotifications: input.assignmentNotifications,
      overdueReminders: input.overdueReminders,
      emailReminders: input.emailReminders,
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { householdId: input.householdId }
  },
)

export const markTaskNotificationRead = secureCallable(
  taskNotificationIdSchema,
  async (input, actor) => {
    const ref = db.doc(`users/${actor.uid}/taskNotifications/${input.notificationId}`)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'Notification not found.')
    await ref.update({ readAt: FieldValue.serverTimestamp() })
    return { notificationId: input.notificationId }
  },
  false,
)

async function claimReminder(
  snapshot: QueryDocumentSnapshot,
  kind: 'DUE' | 'OVERDUE',
): Promise<void> {
  const task = snapshot.data() as HouseholdTask
  const targetUserId = task.assigneeUserId ?? task.createdBy
  const householdId = task.householdId
  const notificationId = `${kind.toLowerCase()}-${digest(`${householdId}:${task.id}:${kind}:${storedIso(kind === 'DUE' ? task.reminderAt : task.dueAt)}`).slice(0, 32)}`
  const expectedAt = storedIso(kind === 'DUE' ? task.reminderAt : task.dueAt)
  await db.runTransaction(async (transaction) => {
    const [fresh, settings, member, existingDelivery] = await Promise.all([
      transaction.get(snapshot.ref),
      transaction.get(db.doc(`users/${targetUserId}/taskNotificationSettings/${householdId}`)),
      transaction.get(db.doc(`households/${householdId}/members/${targetUserId}`)),
      transaction.get(db.doc(`privateTaskReminderDeliveries/${notificationId}`)),
    ])
    if (!fresh.exists || existingDelivery.exists) return
    const current = fresh.data() as HouseholdTask
    const stateField = kind === 'DUE' ? 'reminderState' : 'overdueReminderState'
    const enabledField = kind === 'DUE' ? 'dueReminders' : 'overdueReminders'
    if (
      current.isDeleted ||
      current.status === 'DONE' ||
      current.status === 'CANCELLED' ||
      current[stateField] !== 'PENDING'
    )
      return
    if (storedIso(kind === 'DUE' ? current.reminderAt : current.dueAt) !== expectedAt) return
    const scheduledAt = kind === 'DUE' ? current.reminderAt : current.dueAt
    const scheduledDate = scheduledAt
      ? scheduledAt instanceof Date
        ? scheduledAt
        : scheduledAt.toDate()
      : null
    if (!scheduledDate || scheduledDate.getTime() > Date.now()) return
    if (!member.exists || settings.get(enabledField) !== true) {
      transaction.update(snapshot.ref, { [stateField]: 'CANCELLED', updatedAt: Timestamp.now() })
      return
    }
    const body = kind === 'DUE' ? `${current.title} is due soon.` : `${current.title} is overdue.`
    transaction.set(db.doc(`users/${targetUserId}/taskNotifications/${notificationId}`), {
      id: notificationId,
      householdId,
      taskId: current.id,
      title: kind === 'DUE' ? 'Task reminder' : 'Overdue task',
      body,
      type: kind,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
      pushState: 'PENDING',
      emailRequested: settings.get('emailReminders') === true,
    })
    transaction.set(db.doc(`privateTaskReminderDeliveries/${notificationId}`), {
      id: notificationId,
      householdId,
      taskId: current.id,
      userId: targetUserId,
      type: kind,
      status: 'CLAIMED',
      claimedAt: FieldValue.serverTimestamp(),
    })
    transaction.update(snapshot.ref, { [stateField]: 'SENT', updatedAt: Timestamp.now() })
    writeAudit(db, transaction, {
      householdId,
      userId: targetUserId,
      action: 'TASK_REMINDER_SENT',
      entityType: 'TASK',
      entityId: current.id,
      after: { notificationId, type: kind },
    })
  })
}

export const scheduledTaskReminders = onSchedule(
  { schedule: 'every 5 minutes', region: 'europe-west1', timeZone: 'UTC' },
  async () => {
    const now = Timestamp.now()
    const [due, overdue] = await Promise.all([
      db
        .collectionGroup('tasks')
        .where('reminderState', '==', 'PENDING')
        .where('reminderAt', '<=', now)
        .orderBy('reminderAt', 'asc')
        .limit(100)
        .get(),
      db
        .collectionGroup('tasks')
        .where('overdueReminderState', '==', 'PENDING')
        .where('dueAt', '<', now)
        .orderBy('dueAt', 'asc')
        .limit(100)
        .get(),
    ])
    for (const snapshot of due.docs) await claimReminder(snapshot, 'DUE')
    for (const snapshot of overdue.docs) await claimReminder(snapshot, 'OVERDUE')
  },
)

export const sendTaskNotificationPush = onDocumentCreated(
  { document: 'users/{userId}/taskNotifications/{notificationId}', region: 'europe-west1' },
  async (event) => {
    const notification = event.data?.data() as
      (TaskNotification & { pushState?: string }) | undefined
    const userId = event.params.userId
    const notificationId = event.params.notificationId
    if (!notification) return
    const deliveryRef = db.doc(`privateTaskPushDeliveries/${userId}_${notificationId}`)
    const claimed = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(deliveryRef)
      if (existing.exists) return false
      transaction.set(deliveryRef, {
        userId,
        notificationId,
        status: 'CLAIMED',
        claimedAt: FieldValue.serverTimestamp(),
      })
      return true
    })
    if (!claimed) return
    const devices = await db.collection(`userDevices/${userId}/devices`).get()
    if (devices.empty || process.env.FUNCTIONS_EMULATOR === 'true') {
      if (process.env.FUNCTIONS_EMULATOR === 'true')
        console.info('Mock task push delivery', {
          userId,
          notificationId,
          taskId: notification.taskId,
        })
      await deliveryRef.update({
        status: devices.empty ? 'NO_DEVICES' : 'MOCK_SENT',
        completedAt: FieldValue.serverTimestamp(),
      })
      return
    }
    const tokens = devices.docs.map((device) => String(device.get('fcmToken')))
    let response: BatchResponse
    try {
      response = await adminMessaging.sendEachForMulticast({
        tokens,
        data: {
          title: notification.title,
          body: notification.body,
          url: `/tasks/${notification.taskId}`,
          notificationId,
        },
      })
    } catch (error) {
      await deliveryRef.update({
        status: 'FAILED',
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        completedAt: FieldValue.serverTimestamp(),
      })
      return
    }
    const invalidCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
    ])
    const cleanup = db.batch()
    response.responses.forEach((result, index) => {
      const device = devices.docs[index]
      if (!result.success && device && invalidCodes.has(result.error?.code ?? ''))
        cleanup.delete(device.ref)
    })
    cleanup.update(deliveryRef, {
      status: response.failureCount === response.responses.length ? 'FAILED' : 'SENT',
      successCount: response.successCount,
      failureCount: response.failureCount,
      completedAt: FieldValue.serverTimestamp(),
    })
    await cleanup.commit()
  },
)
