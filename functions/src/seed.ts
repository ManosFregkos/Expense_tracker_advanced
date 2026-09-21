import { Timestamp } from 'firebase-admin/firestore'
import {
  DEFAULT_CATEGORY_SEEDS,
  buildSearchPrefixes,
  transactionAnalyticsDelta,
  mergeAnalyticsDeltas,
  monthKey,
} from '@family-expense-tracker/shared'
import { adminAuth, db } from './firebase.js'
import { applyDelta } from './services/analytics.js'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Seed is emulator-only. Start emulators and set emulator host variables.')
}

const projectId = process.env.GCLOUD_PROJECT ?? 'demo-family-expense-tracker'
const householdId = 'fregkos-family'

async function ensureUser(uid: string, email: string, displayName: string) {
  try {
    await adminAuth.getUser(uid)
  } catch {
    await adminAuth.createUser({
      uid,
      email,
      password: 'DemoPass123!',
      displayName,
      emailVerified: true,
    })
  }
  const now = Timestamp.now()
  await db.doc(`users/${uid}`).set({
    id: uid,
    email,
    displayName,
    locale: 'en-GR',
    householdIds: [householdId],
    createdAt: now,
    updatedAt: now,
  })
}

async function seed() {
  await ensureUser('emmanouil', 'emmanouil@example.test', 'Emmanouil')
  await ensureUser('spouse', 'spouse@example.test', 'Spouse')
  const now = Timestamp.now()
  const batch = db.batch()
  batch.set(db.doc(`households/${householdId}`), {
    id: householdId,
    name: 'Fregkos Family',
    defaultCurrency: 'EUR',
    timeZone: 'Europe/Athens',
    createdBy: 'emmanouil',
    createdAt: now,
    updatedAt: now,
  })
  for (const [uid, displayName, role] of [
    ['emmanouil', 'Emmanouil', 'OWNER'],
    ['spouse', 'Spouse', 'ADMIN'],
  ] as const) {
    batch.set(db.doc(`households/${householdId}/members/${uid}`), {
      userId: uid,
      householdId,
      displayName,
      role,
      joinedAt: now,
    })
  }
  for (const seed of DEFAULT_CATEGORY_SEEDS) {
    batch.set(db.doc(`households/${householdId}/categories/${seed.id}`), {
      id: seed.id,
      householdId,
      name: seed.name,
      normalizedName: seed.name.trim().toLowerCase(),
      type: seed.type,
      ...(seed.parentId ? { parentCategoryId: seed.parentId } : {}),
      ...(seed.icon ? { icon: seed.icon } : {}),
      isSystem: true,
      origin: 'SYSTEM',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
  }
  for (const [index, list] of (
    [
      ['task-list-home', 'Home', 'home'],
      ['task-list-shopping', 'Shopping', 'shopping-cart'],
      ['task-list-appointments', 'Appointments', 'calendar'],
      ['task-list-bills-admin', 'Bills & Admin', 'file-invoice'],
      ['task-list-car', 'Car', 'car'],
    ] as const
  ).entries()) {
    const [id, name, icon] = list
    batch.set(db.doc(`households/${householdId}/taskLists/${id}`), {
      id,
      householdId,
      name,
      normalizedName: name.toLowerCase(),
      icon,
      sortOrder: index * 1000,
      isArchived: false,
      createdBy: 'emmanouil',
      createdAt: now,
      updatedAt: now,
    })
  }
  const accounts = [
    ['em-eurobank', 'emmanouil', 'Eurobank', 'BANK', 510000],
    ['em-alpha', 'emmanouil', 'Alpha Bank', 'BANK', 320000],
    ['em-cash', 'emmanouil', 'Cash', 'CASH', 24000],
    ['sp-national', 'spouse', 'National Bank', 'BANK', 290000],
    ['sp-eurobank', 'spouse', 'Eurobank', 'BANK', 170000],
    ['sp-cash', 'spouse', 'Cash', 'CASH', 10000],
  ] as const
  for (const [id, ownerUserId, name, type, balance] of accounts) {
    batch.set(db.doc(`households/${householdId}/accounts/${id}`), {
      id,
      householdId,
      ownerUserId,
      name,
      type,
      institution: type === 'BANK' ? name : undefined,
      currency: 'EUR',
      openingBalanceMinor: balance,
      currentBalanceMinor: balance,
      appCalculatedBalanceMinor: balance,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
  }
  await batch.commit()

  const samples = [
    {
      id: 'salary-sep',
      type: 'INCOME',
      amountMinor: 300000,
      accountId: 'em-eurobank',
      ownerUserId: 'emmanouil',
      categoryId: 'income-salary',
      description: 'September salary',
      merchant: 'Employer',
      date: '2026-09-01T09:00:00.000Z',
    },
    {
      id: 'groceries-sep',
      type: 'EXPENSE',
      amountMinor: 7243,
      accountId: 'em-eurobank',
      ownerUserId: 'emmanouil',
      categoryId: 'expense-food-supermarket',
      description: 'Weekly groceries',
      merchant: 'Lidl',
      date: '2026-09-12T16:20:00.000Z',
    },
    {
      id: 'fuel-sep',
      type: 'EXPENSE',
      amountMinor: 6500,
      accountId: 'sp-eurobank',
      ownerUserId: 'spouse',
      categoryId: 'expense-transport-fuel',
      description: 'Fuel',
      merchant: 'Shell',
      date: '2026-09-15T11:00:00.000Z',
    },
  ] as const
  const aggregateByMonth = new Map<string, ReturnType<typeof transactionAnalyticsDelta>>()
  for (const sample of samples) {
    const transaction = {
      id: sample.id,
      householdId,
      type: sample.type,
      amountMinor: sample.amountMinor,
      accountId: sample.accountId,
      ownerUserId: sample.ownerUserId,
      categoryId: sample.categoryId,
      currency: 'EUR',
      description: sample.description,
      merchant: sample.merchant,
      transactionDate: Timestamp.fromDate(new Date(sample.date)),
      source: 'MANUAL',
      createdBy: sample.ownerUserId,
      searchPrefixes: buildSearchPrefixes(sample.description, sample.merchant),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    } as const
    await db.doc(`households/${householdId}/transactions/${sample.id}`).set(transaction)
    const key = monthKey(new Date(sample.date), 'Europe/Athens')
    aggregateByMonth.set(
      key,
      mergeAnalyticsDeltas(
        aggregateByMonth.get(key) ?? {
          incomeMinor: 0,
          expenseMinor: 0,
          transactionCount: 0,
          byCategory: {},
          byMember: {},
          byAccount: {},
          byMerchant: {},
        },
        transactionAnalyticsDelta(transaction),
      ),
    )
  }
  for (const [key, delta] of aggregateByMonth)
    await db
      .doc(`households/${householdId}/monthlyAnalytics/${key}`)
      .set(applyDelta(undefined, key, 'EUR', delta))
  console.info(`Seeded ${projectId}: emmanouil@example.test / DemoPass123!`)
}

await seed()
