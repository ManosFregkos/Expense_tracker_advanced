import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { TransactionDrawer } from './TransactionDrawer'

const Context = createContext<{ open(): void }>({ open: () => undefined })
export function AddTransactionProvider({ children }: { children: ReactNode }) {
  const [opened, { open, close }] = useDisclosure(false)
  const value = useMemo(() => ({ open }), [open])
  return (
    <Context.Provider value={value}>
      {children}
      <TransactionDrawer opened={opened} onClose={close} />
    </Context.Provider>
  )
}
export function useAddTransaction() {
  return useContext(Context)
}
