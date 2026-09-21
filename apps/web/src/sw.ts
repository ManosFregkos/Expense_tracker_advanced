/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> }

clientsClaim()
void self.skipWaiting()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

onBackgroundMessage(getMessaging(app), async (payload) => {
  const title = payload.data?.title ?? 'Household task'
  await self.registration.showNotification(title, {
    body: payload.data?.body ?? 'A task needs your attention.',
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    tag: payload.data?.notificationId ?? 'household-task',
    data: { url: payload.data?.url ?? '/tasks' },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = String((event.notification.data as { url?: string } | undefined)?.url ?? '/tasks')
  event.waitUntil(self.clients.openWindow(new URL(url, self.location.origin).href))
})
