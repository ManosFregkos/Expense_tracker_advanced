import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

const app = getApps()[0] ?? initializeApp()

export const db = getFirestore(app)
export const adminAuth = getAuth(app)
export const adminMessaging = getMessaging(app)
db.settings({ ignoreUndefinedProperties: true })
