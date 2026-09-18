import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { useHousehold } from '../features/households/HouseholdProvider'

export function HouseholdGate() {
  const { household, loading } = useHousehold()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!household && location.pathname !== '/onboarding')
    return <Navigate to="/onboarding" replace />
  return <Outlet />
}
