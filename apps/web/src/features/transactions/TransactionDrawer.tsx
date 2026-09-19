import { Drawer } from '@mantine/core'
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
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={transaction ? 'Edit transaction' : 'Add transaction'}
      position="right"
      size="md"
      overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
    >
      {opened && <TransactionForm transaction={transaction} onSaved={onClose} />}
    </Drawer>
  )
}
