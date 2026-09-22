import {
  AppShell,
  Avatar,
  Burger,
  Button,
  Group,
  NavLink,
  Select,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconChartBar,
  IconCreditCard,
  IconHome,
  IconLogout,
  IconPlus,
  IconReceipt,
  IconSettings,
  IconChecklist,
  IconUsers,
  IconMoodKid,
} from '@tabler/icons-react'
import { signOut } from 'firebase/auth'
import { NavLink as RouterNavLink, Outlet, useLocation } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { useAuth } from '../features/auth/AuthProvider'
import { useHousehold } from '../features/households/HouseholdProvider'
import { useAddTransaction } from '../features/transactions/AddTransactionProvider'
import { OfflineBanner } from './OfflineBanner'
import { useTaskDueCount } from '../features/tasks/hooks'
import { TaskNotificationMenu } from '../features/tasks/components/TaskNotificationMenu'

const nav = [
  ['/dashboard', 'Dashboard', IconHome],
  ['/transactions', 'Transactions', IconReceipt],
  ['/transactions/review', 'Review transactions', IconReceipt],
  ['/accounts', 'Accounts', IconCreditCard],
  ['/analytics', 'Analytics', IconChartBar],
  ['/members', 'Members', IconUsers],
  ['/tasks', 'Tasks', IconChecklist],
  ['/settings', 'Settings', IconSettings],
] as const

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const location = useLocation()
  const { user } = useAuth()
  const { household, households, setActiveHouseholdId } = useHousehold()
  const add = useAddTransaction()
  const taskCount = useTaskDueCount()
  return (
    <AppShell
      header={{ height: { base: 60, sm: 68 } }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header>
        <Group
          className="app-header"
          h="100%"
          px={{ base: 'sm', sm: 'xl' }}
          justify="space-between"
          wrap="nowrap"
        >
          <Group gap="xs" wrap="nowrap" className="app-header-brand">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <Text fw={800} c="teal.9" size="lg" className="app-brand">
              Family Finance
            </Text>
          </Group>
          <Group gap="xs" wrap="nowrap" className="app-header-actions">
            <TaskNotificationMenu />
            <Select
              className="desktop-only"
              w={220}
              aria-label="Active household"
              value={household?.id ?? null}
              onChange={(value) => value && setActiveHouseholdId(value)}
              data={households.map((item) => ({ value: item.id, label: item.name }))}
            />
            <Button
              className="desktop-only"
              leftSection={<IconPlus size={17} />}
              onClick={add.open}
            >
              Add transaction
            </Button>
            <UnstyledButton component={RouterNavLink} to="/profile" aria-label="Profile">
              <Avatar color="teal" radius="xl">
                {user?.displayName?.slice(0, 1) ?? user?.email?.slice(0, 1)}
              </Avatar>
            </UnstyledButton>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md" className="app-navbar">
        <Stack h="100%" gap={4}>
          <Text px="sm" py="md" size="xs" fw={700} c="dimmed">
            {household?.name ?? 'HOUSEHOLD'}
          </Text>
          <Select
            className="mobile-only mobile-household-select"
            aria-label="Active household"
            value={household?.id ?? null}
            onChange={(value) => value && setActiveHouseholdId(value)}
            data={households.map((item) => ({ value: item.id, label: item.name }))}
            mb="sm"
          />
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              component={RouterNavLink}
              to={to}
              label={
                label === 'Tasks' && (taskCount.data ?? 0) > 0
                  ? `${label}  ${taskCount.data}`
                  : label
              }
              leftSection={<Icon size={19} />}
              active={location.pathname.startsWith(to)}
              onClick={close}
              mt={label === 'Tasks' ? 'md' : undefined}
              pt={label === 'Tasks' ? 'sm' : undefined}
              style={label === 'Tasks' ? { borderTop: '1px solid #dde5e2' } : undefined}
            />
          ))}
          <NavLink
            component={RouterNavLink}
            to="/kids"
            label="Kids"
            leftSection={<IconMoodKid size={19} />}
            onClick={close}
          />
          <NavLink
            mt="auto"
            label="Sign out"
            leftSection={<IconLogout size={19} />}
            onClick={() => void signOut(auth)}
          />
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <OfflineBanner />
        <Outlet />
      </AppShell.Main>
      <nav className="mobile-only mobile-bottom-nav" aria-label="Primary">
        <div className="mobile-bottom-nav-inner">
          {nav
            .filter(([to]) => ['/dashboard', '/transactions', '/tasks', '/settings'].includes(to))
            .map(([to, label, Icon]) => (
              <UnstyledButton
                key={to}
                component={RouterNavLink}
                to={to}
                className="mobile-nav-link"
                aria-label={label}
                aria-current={location.pathname.startsWith(to) ? 'page' : undefined}
                ta="center"
                c={location.pathname.startsWith(to) ? 'teal.9' : 'gray.6'}
              >
                <Icon size={22} />
                <Text size="xs">
                  {label === 'Dashboard'
                    ? 'Home'
                    : label === 'Transactions'
                      ? 'Activity'
                      : label === 'Settings'
                        ? 'More'
                        : label}
                </Text>
              </UnstyledButton>
            ))}
          <UnstyledButton
            className="mobile-nav-link"
            onClick={add.open}
            ta="center"
            c="teal.9"
            aria-label="Add transaction"
          >
            <IconPlus size={30} />
            <Text size="xs">Add</Text>
          </UnstyledButton>
        </div>
      </nav>
    </AppShell>
  )
}
