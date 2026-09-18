import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Household } from '@family-expense-tracker/shared'
import { useAuth } from '../auth/AuthProvider'
import { householdKeys } from '../../lib/query-keys'
import { listHouseholds } from '../../lib/repositories'

interface HouseholdState {
  households: Household[]
  household: Household | null
  setActiveHouseholdId(id: string): void
  loading: boolean
}
const HouseholdContext = createContext<HouseholdState>({
  households: [],
  household: null,
  setActiveHouseholdId: () => undefined,
  loading: true,
})
const EMPTY_HOUSEHOLDS: Household[] = []

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [activeId, setActiveId] = useState(() => localStorage.getItem('activeHouseholdId'))
  const query = useQuery({
    queryKey: householdKeys.all,
    queryFn: () => listHouseholds(user!.uid),
    enabled: Boolean(user),
  })
  const households = query.data ?? EMPTY_HOUSEHOLDS
  const household = households.find((item) => item.id === activeId) ?? households[0] ?? null
  useEffect(() => {
    if (household) localStorage.setItem('activeHouseholdId', household.id)
  }, [household])
  const value = useMemo(
    () => ({ households, household, setActiveHouseholdId: setActiveId, loading: query.isLoading }),
    [households, household, query.isLoading],
  )
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  return useContext(HouseholdContext)
}
