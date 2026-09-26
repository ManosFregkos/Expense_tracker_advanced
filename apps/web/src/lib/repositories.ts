import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { normalizeSearchText, taskDueAt, type BankConnection, type BankTransaction, type CardLearningProgress, type Category, type FinancialAccount, type Household, type HouseholdMember, type HouseholdTask, type Invitation, type KidsCardSession, type KidsChildProfile, type KidsSettings, type MonthlyAnalytics, type TaskActivity, type TaskList, type TaskNotification, type TaskNotificationSettings, type TaskSubtask, type Transaction } from '@family-expense-tracker/shared'
import { firestore } from './firebase'

export async function listHouseholds(userId: string): Promise<Household[]> {
  const user = await getDoc(doc(firestore, 'users', userId))
  const ids = (user.data()?.householdIds as string[] | undefined) ?? []
  const snapshots = await Promise.all(ids.map((id) => getDoc(doc(firestore, 'households', id))))
  return snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => snapshot.data() as Household)
}

async function listCollection<T>(path: string): Promise<T[]> {
  return (await getDocs(collection(firestore, path))).docs.map((snapshot) => snapshot.data() as T)
}

export const listMembers = (householdId: string) => listCollection<HouseholdMember>(`households/${householdId}/members`)
export const listAccounts = (householdId: string) => listCollection<FinancialAccount>(`households/${householdId}/accounts`)
export const listCategories = (householdId: string) => listCollection<Category>(`households/${householdId}/categories`)
export const listMonthlyAnalytics = (householdId: string) => listCollection<MonthlyAnalytics>(`households/${householdId}/monthlyAnalytics`)
export const listBankConnections = (householdId: string) => listCollection<BankConnection>(`households/${householdId}/bankConnections`)
export const listKidsChildProfiles = (householdId: string) =>
  listCollection<KidsChildProfile>(`households/${householdId}/childProfiles`)
export async function getKidsSettings(householdId: string, profileId: string): Promise<KidsSettings> {
  const snapshot = await getDoc(doc(firestore, `households/${householdId}/kidsSettings/${profileId}`))
  return snapshot.exists()
    ? (snapshot.data() as KidsSettings)
    : {
        childProfileId: profileId,
        narrationEnabled: true,
        soundEffectsEnabled: true,
        animationsEnabled: true,
        sessionLength: 5,
        difficultyMode: 'AUTO',
        currentDifficulty: 1,
        earlyMath: {
          numberRange: 'ONE_TO_FIVE',
          addition: 'WITHIN_THREE',
          showNumerals: 'AUTO',
          fingersEnabled: true,
          countObjectsEnabled: true,
        },
        flags: { enabled: true, tier: 'AUTO', newPerSession: 3 },
        updatedAt: new Date(0),
      }
}
export async function listKidsProgress(householdId: string, profileId: string) {
  const snapshot = await getDocs(
    query(
      collection(firestore, `households/${householdId}/kidsCardProgress`),
      where('childProfileId', '==', profileId),
    ),
  )
  return snapshot.docs.map((document) => document.data() as CardLearningProgress)
}
export async function listKidsSessions(householdId: string, profileId: string) {
  const snapshot = await getDocs(
    query(
      collection(firestore, `households/${householdId}/kidsSessions`),
      where('childProfileId', '==', profileId),
    ),
  )
  return snapshot.docs
    .map((document) => document.data() as KidsCardSession)
    .sort((left, right) => {
      const rightDate = right.startedAt instanceof Date ? right.startedAt : right.startedAt.toDate()
      const leftDate = left.startedAt instanceof Date ? left.startedAt : left.startedAt.toDate()
      return Number(rightDate) - Number(leftDate)
    })
}
export async function listReviewBankTransactions(householdId: string): Promise<BankTransaction[]> {
  const snapshot = await getDocs(query(collection(firestore, `households/${householdId}/bankTransactions`), where('reconciliationStatus', '==', 'REVIEW'), orderBy('bookingDate', 'desc')))
  return snapshot.docs.map((document) => document.data() as BankTransaction)
}
export async function listPendingBankTransactions(householdId: string): Promise<BankTransaction[]> {
  const snapshot = await getDocs(query(collection(firestore, `households/${householdId}/bankTransactions`), where('status', '==', 'PENDING')))
  return snapshot.docs.map((document) => document.data() as BankTransaction)
}

export interface TransactionFilters {
  start?: Date
  end?: Date
  accountId?: string
  memberId?: string
  categoryId?: string
  type?: Transaction['type']
  search?: string
  pageSize?: number
  cursor?: DocumentSnapshot
}

export async function listTransactions(householdId: string, filters: TransactionFilters = {}) {
  const constraints: QueryConstraint[] = [where('isDeleted', '==', false), orderBy('transactionDate', 'desc'), limit(filters.pageSize ?? 25)]
  if (filters.start) constraints.unshift(where('transactionDate', '>=', filters.start))
  if (filters.end) constraints.unshift(where('transactionDate', '<', filters.end))
  if (filters.accountId) constraints.unshift(where('accountId', '==', filters.accountId))
  if (filters.memberId) constraints.unshift(where('ownerUserId', '==', filters.memberId))
  if (filters.categoryId) constraints.unshift(where('categoryId', '==', filters.categoryId))
  if (filters.type) constraints.unshift(where('type', '==', filters.type))
  const searchToken = filters.search ? normalizeSearchText(filters.search).split(' ')[0] : undefined
  if (searchToken) constraints.unshift(where('searchPrefixes', 'array-contains', searchToken))
  if (filters.cursor) constraints.push(startAfter(filters.cursor))
  const snapshot = await getDocs(query(collection(firestore, `households/${householdId}/transactions`), ...constraints))
  const transactions = snapshot.docs.map((document) => document.data() as Transaction)
  return { transactions, cursor: snapshot.docs.at(-1), hasMore: snapshot.size === (filters.pageSize ?? 25) }
}

export async function getTransaction(householdId: string, transactionId: string): Promise<Transaction | null> {
  const snapshot = await getDoc(doc(firestore, `households/${householdId}/transactions/${transactionId}`))
  return snapshot.exists() ? (snapshot.data() as Transaction) : null
}

export async function listMyInvitations(email: string): Promise<Invitation[]> {
  const snapshot = await getDocs(query(collection(firestore, 'invitations'), where('emailLower', '==', email.toLowerCase()), where('status', '==', 'PENDING')))
  return snapshot.docs.map((document) => document.data() as Invitation)
}

export async function listHouseholdInvitations(householdId: string): Promise<Invitation[]> {
  const snapshot = await getDocs(query(collection(firestore, 'invitations'), where('householdId', '==', householdId), where('status', '==', 'PENDING')))
  return snapshot.docs.map((document) => document.data() as Invitation)
}

export async function getHousehold(id: string): Promise<Household | null> {
  const snapshot = await getDoc(doc(firestore, 'households', id))
  return snapshot.exists() ? (snapshot.data() as Household) : null
}

export type TaskView = 'today' | 'upcoming' | 'all' | 'completed'
export interface TaskQueryFilters {
  view: TaskView
  todayKey: string
  timeZone: string
  pageSize?: number
  cursor?: DocumentSnapshot
}

export async function listTasks(householdId: string, filters: TaskQueryFilters) {
  const collectionRef = collection(firestore, `households/${householdId}/tasks`)
  const pageSize = filters.pageSize ?? 100
  const constraints: QueryConstraint[] = [where('isDeleted', '==', false)]
  if (filters.view === 'completed') {
    constraints.push(
      where('status', 'in', ['DONE', 'CANCELLED']),
      orderBy('updatedAt', 'desc'),
      limit(pageSize),
    )
  } else {
    constraints.push(where('status', 'in', ['TODO', 'IN_PROGRESS']))
    if (filters.view === 'today') {
      constraints.push(
        where('dueAt', '<=', taskDueAt(filters.todayKey, null, filters.timeZone)),
        orderBy('dueAt', 'asc'),
        limit(pageSize),
      )
    } else if (filters.view === 'upcoming') {
      constraints.push(
        where('dueAt', '>', taskDueAt(filters.todayKey, null, filters.timeZone)),
        orderBy('dueAt', 'asc'),
        limit(pageSize),
      )
    } else constraints.push(orderBy('sortOrder', 'asc'), limit(pageSize))
  }
  if (filters.cursor) constraints.push(startAfter(filters.cursor))
  const snapshot = await getDocs(query(collectionRef, ...constraints))
  return {
    tasks: snapshot.docs.map((document) => document.data() as HouseholdTask),
    cursor: snapshot.docs.at(-1),
    hasMore: snapshot.size === pageSize,
  }
}

export async function getTask(householdId: string, taskId: string): Promise<HouseholdTask | null> {
  const snapshot = await getDoc(doc(firestore, `households/${householdId}/tasks/${taskId}`))
  if (!snapshot.exists() || snapshot.get('isDeleted') === true) return null
  return snapshot.data() as HouseholdTask
}

export const listTaskLists = (householdId: string) =>
  listCollection<TaskList>(`households/${householdId}/taskLists`)

export const listSubtasks = (householdId: string, taskId: string) =>
  listCollection<TaskSubtask>(`households/${householdId}/tasks/${taskId}/subtasks`)

export async function listTaskActivity(householdId: string, taskId: string) {
  const snapshot = await getDocs(
    query(
      collection(firestore, `households/${householdId}/taskActivity`),
      where('taskId', '==', taskId),
      orderBy('timestamp', 'desc'),
      limit(50),
    ),
  )
  return snapshot.docs.map((document) => document.data() as TaskActivity)
}

export async function taskDueCount(
  householdId: string,
  todayKey: string,
  timeZone: string,
): Promise<number> {
  const result = await getCountFromServer(
    query(
      collection(firestore, `households/${householdId}/tasks`),
      where('isDeleted', '==', false),
      where('status', 'in', ['TODO', 'IN_PROGRESS']),
      where('dueAt', '<=', taskDueAt(todayKey, null, timeZone)),
    ),
  )
  return result.data().count
}

export async function listTaskNotifications(userId: string): Promise<TaskNotification[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore, `users/${userId}/taskNotifications`),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
  )
  return snapshot.docs.map((document) => document.data() as TaskNotification)
}

export async function getTaskNotificationSettings(userId: string, householdId: string) {
  const snapshot = await getDoc(
    doc(firestore, `users/${userId}/taskNotificationSettings/${householdId}`),
  )
  return snapshot.exists()
    ? (snapshot.data() as TaskNotificationSettings)
    : {
        householdId,
        dueReminders: false,
        assignmentNotifications: false,
        overdueReminders: false,
        emailReminders: false,
        updatedAt: new Date(0),
      }
}
