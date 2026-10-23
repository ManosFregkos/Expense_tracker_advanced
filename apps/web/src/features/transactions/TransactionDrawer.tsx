import { Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { Transaction } from '@family-expense-tracker/shared'
import { TransactionForm } from './TransactionForm'

export function TransactionDrawer({
  opened,
  onClose,
  transaction,
}: {
  opened: boolean
  onClose(): void
  transaction?: Transaction
}) {
  const mobile = useMediaQuery('(max-width: 48em)')
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={transaction ? 'Edit transaction' : 'Add transaction'}
      position={mobile ? 'bottom' : 'right'}
      size={mobile ? '100%' : 'md'}
      styles={mobile ? { content: { height: '100%' } } : undefined}
      overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
    >
      {opened && <TransactionForm transaction={transaction} onSaved={onClose} />}
    </Drawer>
  )
}
