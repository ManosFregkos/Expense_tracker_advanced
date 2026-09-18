import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { useAuth } from '../features/auth/AuthProvider'
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (
    user.providerData.some((provider) => provider.providerId === 'password') &&
    !user.emailVerified
  )
    return <VerifyEmailPage />
  return <Outlet />
}
