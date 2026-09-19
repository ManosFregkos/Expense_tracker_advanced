import { useQuery } from '@tanstack/react-query'
import {
  accountKeys,
  analyticsKeys,
  categoryKeys,
  householdKeys,
  transactionKeys,
  bankingKeys,
} from '../lib/query-keys'
import {
  listAccounts,
  listCategories,
  listMembers,
  listMonthlyAnalytics,
  listTransactions,
  listBankConnections,
  listReviewBankTransactions,
  listPendingBankTransactions,
} from '../lib/repositories'
import { useHousehold } from '../features/households/HouseholdProvider'

export function useMembers() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: householdKeys.members(household?.id ?? ''),
    queryFn: () => listMembers(household!.id),
    enabled: Boolean(household),
  })
}
export function useAccounts() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: accountKeys.all(household?.id ?? ''),
    queryFn: () => listAccounts(household!.id),
    enabled: Boolean(household),
  })
}
export function useCategories() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: categoryKeys.all(household?.id ?? ''),
    queryFn: () => listCategories(household!.id),
    enabled: Boolean(household),
  })
}
export function useMonthlyAnalytics() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: analyticsKeys.monthly(household?.id ?? ''),
    queryFn: () => listMonthlyAnalytics(household!.id),
    enabled: Boolean(household),
  })
}
export function useLatestTransactions(count = 8) {
  const { household } = useHousehold()
  return useQuery({
    queryKey: transactionKeys.list(household?.id ?? '', { latest: count }),
    queryFn: () => listTransactions(household!.id, { pageSize: count }),
    enabled: Boolean(household),
  })
}
export function useBankConnections() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: bankingKeys.connections(household?.id ?? ''),
    queryFn: () => listBankConnections(household!.id),
    enabled: Boolean(household),
  })
}
export function useReviewBankTransactions() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: bankingKeys.review(household?.id ?? ''),
    queryFn: () => listReviewBankTransactions(household!.id),
    enabled: Boolean(household),
  })
}
export function usePendingBankTransactions() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: bankingKeys.pending(household?.id ?? ''),
    queryFn: () => listPendingBankTransactions(household!.id),
    enabled: Boolean(household),
  })
}
