import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging'
import { app } from './firebase'

export async function enableTaskPush(): Promise<string> {
  if (!(await isSupported())) throw new Error('Push notifications are not supported in this browser.')
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) throw new Error('Web Push is not configured for this environment.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error('Could not register this browser for notifications.')
  return token
}

export async function listenForTaskMessages(
  listener: (payload: MessagePayload) => void,
): Promise<() => void> {
  if (!(await isSupported())) return () => undefined
  return onMessage(getMessaging(app), listener)
}
