import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { normalizeSearchText, type Category, type FinancialAccount, type Household, type HouseholdMember, type Invitation, type MonthlyAnalytics, type Transaction } from '@family-expense-tracker/shared'
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
