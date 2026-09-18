import { useQuery } from '@tanstack/react-query'
import {
  accountKeys,
  analyticsKeys,
  categoryKeys,
  householdKeys,
  transactionKeys,
} from '../lib/query-keys'
import {
  listAccounts,
  listCategories,
  listMembers,
  listMonthlyAnalytics,
  listTransactions,
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
