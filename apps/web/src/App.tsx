import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingScreen } from './components/LoadingScreen'
import { AppLayout } from './components/AppLayout'
import { AuthPage } from './features/auth/AuthPage'
import { HouseholdProvider } from './features/households/HouseholdProvider'
import { AddTransactionProvider } from './features/transactions/AddTransactionProvider'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { HouseholdGate } from './routes/HouseholdGate'
import { ProtectedRoute } from './routes/ProtectedRoute'

const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const TransactionsPage = lazy(() =>
  import('./features/transactions/TransactionsPage').then((module) => ({
    default: module.TransactionsPage,
  })),
)
const TransactionDetailPage = lazy(() =>
  import('./features/transactions/TransactionDetailPage').then((module) => ({
    default: module.TransactionDetailPage,
  })),
)
const AccountsPage = lazy(() =>
  import('./features/accounts/AccountsPage').then((module) => ({ default: module.AccountsPage })),
)
const AnalyticsPage = lazy(() =>
  import('./features/analytics/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
)
const MembersPage = lazy(() =>
  import('./features/members/MembersPage').then((module) => ({ default: module.MembersPage })),
)
const CategoriesPage = lazy(() =>
  import('./features/categories/CategoriesPage').then((module) => ({
    default: module.CategoriesPage,
  })),
)
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })),
)
const BankConnectionsPage = lazy(() =>
  import('./features/banking/BankConnectionsPage').then((module) => ({
    default: module.BankConnectionsPage,
  })),
)
const ReviewTransactionsPage = lazy(() =>
  import('./features/banking/ReviewTransactionsPage').then((module) => ({
    default: module.ReviewTransactionsPage,
  })),
)
const TasksPage = lazy(() =>
  import('./features/tasks/TasksPage').then((module) => ({ default: module.TasksPage })),
)
const KidsShell = lazy(() =>
  import('./features/kids/components/KidsShell').then((module) => ({ default: module.KidsShell })),
)
const KidsHubPage = lazy(() =>
  import('./features/kids/pages/KidsHubPage').then((module) => ({ default: module.KidsHubPage })),
)
const KidsModePage = lazy(() =>
  import('./features/kids/pages/KidsModePage').then((module) => ({ default: module.KidsModePage })),
)
const KidsDeckPage = lazy(() =>
  import('./features/kids/pages/KidsDeckPage').then((module) => ({ default: module.KidsDeckPage })),
)
const KidsSessionPage = lazy(() =>
  import('./features/kids/pages/KidsSessionPage').then((module) => ({
    default: module.KidsSessionPage,
  })),
)
const KidsParentSettingsPage = lazy(() =>
  import('./features/kids/pages/KidsParentSettingsPage').then((module) => ({
    default: module.KidsParentSettingsPage,
  })),
)

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <HouseholdProvider>
                <HouseholdGate />
              </HouseholdProvider>
            }
          >
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route
              element={
                <AddTransactionProvider>
                  <AppLayout />
                </AddTransactionProvider>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/transactions/:transactionId" element={<TransactionDetailPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bank-connections" element={<BankConnectionsPage />} />
              <Route path="/transactions/review" element={<ReviewTransactionsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/tasks/:taskId" element={<TasksPage />} />
              <Route path="/settings/kids" element={<KidsParentSettingsPage />} />
            </Route>
            <Route element={<KidsShell />}>
              <Route path="/kids" element={<KidsHubPage />} />
              <Route path="/kids/modes/:category" element={<KidsModePage />} />
              <Route path="/kids/decks/:mode" element={<KidsDeckPage />} />
              <Route path="/kids/play/:mode/:deckId" element={<KidsSessionPage />} />
              <Route path="/kids/learn" element={<Navigate to="/kids/modes/learn" replace />} />
              <Route path="/kids/observe" element={<Navigate to="/kids/modes/observe" replace />} />
              <Route path="/kids/think" element={<Navigate to="/kids/modes/think" replace />} />
            </Route>
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
