import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.argv[2]
if (!email) {
  throw new Error('An email address is required')
}

const app = initializeApp({ projectId: 'demo-family-expense-tracker' }, `e2e-${Date.now()}`)

try {
  const users = await getAuth(app).listUsers()
  const user = users.users.find((candidate) => candidate.email === email)
  if (!user) {
    throw new Error(`E2E user was not found: ${email}`)
  }
  await getAuth(app).updateUser(user.uid, { emailVerified: true })
} finally {
  await deleteApp(app)
}
