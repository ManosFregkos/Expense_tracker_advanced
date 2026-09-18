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
  IconUsers,
} from '@tabler/icons-react'
import { signOut } from 'firebase/auth'
import { NavLink as RouterNavLink, Outlet, useLocation } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { useAuth } from '../features/auth/AuthProvider'
import { useHousehold } from '../features/households/HouseholdProvider'
import { useAddTransaction } from '../features/transactions/AddTransactionProvider'
import { OfflineBanner } from './OfflineBanner'

const nav = [
  ['/dashboard', 'Dashboard', IconHome],
  ['/transactions', 'Transactions', IconReceipt],
  ['/accounts', 'Accounts', IconCreditCard],
  ['/analytics', 'Analytics', IconChartBar],
  ['/members', 'Members', IconUsers],
  ['/settings', 'Settings', IconSettings],
] as const

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const location = useLocation()
  const { user } = useAuth()
  const { household, households, setActiveHouseholdId } = useHousehold()
  const add = useAddTransaction()
  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px={{ base: 'md', sm: 'xl' }} justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <Text fw={800} c="teal.9" size="lg">
              Family Finance
            </Text>
          </Group>
          <Group>
            <Select
              className="desktop-only"
              w={220}
              aria-label="Active household"
              value={household?.id ?? null}
              onChange={(value) => value && setActiveHouseholdId(value)}
              data={households.map((item) => ({ value: item.id, label: item.name }))}
            />
            <Button leftSection={<IconPlus size={17} />} onClick={add.open}>
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
      <AppShell.Navbar p="md">
        <Stack h="100%" gap={4}>
          <Text px="sm" py="md" size="xs" fw={700} c="dimmed">
            {household?.name ?? 'HOUSEHOLD'}
          </Text>
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              component={RouterNavLink}
              to={to}
              label={label}
              leftSection={<Icon size={19} />}
              active={location.pathname.startsWith(to)}
              onClick={close}
            />
          ))}
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
      <nav className="mobile-only" aria-label="Primary">
        <Group
          pos="fixed"
          bottom={0}
          left={0}
          right={0}
          bg="white"
          style={{
            zIndex: 200,
            borderTop: '1px solid #dde5e2',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          h={70}
          justify="space-around"
        >
          {nav
            .filter(([to]) =>
              ['/dashboard', '/transactions', '/analytics', '/settings'].includes(to),
            )
            .map(([to, label, Icon]) => (
              <UnstyledButton
                key={to}
                component={RouterNavLink}
                to={to}
                ta="center"
                c={location.pathname.startsWith(to) ? 'teal.9' : 'gray.6'}
              >
                <Icon size={22} />
                <Text size="xs">{label === 'Settings' ? 'More' : label}</Text>
              </UnstyledButton>
            ))}
          <UnstyledButton onClick={add.open} ta="center" c="teal.9" aria-label="Add transaction">
            <IconPlus size={30} />
            <Text size="xs">Add</Text>
          </UnstyledButton>
        </Group>
      </nav>
    </AppShell>
  )
}
