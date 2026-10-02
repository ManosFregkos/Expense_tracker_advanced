import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8280' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9199'
) {
  throw new Error('This fixture requires the E2E emulators.')
}
const email = process.argv[2]
const app = initializeApp({ projectId: 'demo-family-expense-tracker' }, `pagination-${Date.now()}`)
try {
  const user = await getAuth(app).getUserByEmail(email)
  const db = getFirestore(app)
  const householdId = (await db.doc(`users/${user.uid}`).get()).get('householdIds')[0]
  const path = `households/${householdId}`
  const account = (await db.collection(`${path}/accounts`).where('name', '==', 'Eurobank').get())
    .docs[0]
  const category = (
    await db.collection(`${path}/categories`).where('name', '==', 'Supermarket').get()
  ).docs[0]
  const signIn = await fetch(
    'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'DemoPass123!', returnSecureToken: true }),
    },
  )
  const { idToken } = await signIn.json()
  if (!idToken) throw new Error('Could not sign in to the auth emulator.')
  // Use the real callable to preserve balances, analytics and audit records.
  for (let index = 0; index < 26; index++) {
    const response = await fetch(
      'http://127.0.0.1:5101/demo-family-expense-tracker/europe-west1/createTransaction',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          data: {
            householdId,
            type: 'EXPENSE',
            accountId: account.id,
            ownerUserId: user.uid,
            categoryId: category.id,
            amountMinor: 100,
            currency: 'EUR',
            description: `Pagination purchase ${index + 1}`,
            transactionDate: new Date().toISOString(),
            source: 'MANUAL',
          },
        }),
      },
    )
    const result = await response.json()
    if (!response.ok || result.error) throw new Error(JSON.stringify(result))
  }
} finally {
  await deleteApp(app)
}
