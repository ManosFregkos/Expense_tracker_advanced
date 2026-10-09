import { Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { Transaction, JarvisExpenseDraft } from '@family-expense-tracker/shared'
import { TransactionForm } from './TransactionForm'

export function TransactionDrawer({
  opened,
  onClose,
  transaction,
  initialDraft,
}: {
  opened: boolean
  onClose(): void
  transaction?: Transaction
  initialDraft?: JarvisExpenseDraft
}) {
  const mobile = useMediaQuery('(max-width: 48em)')
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        transaction
          ? 'Edit transaction'
          : initialDraft
            ? 'Review Jarvis expense'
            : 'Add transaction'
      }
      position={mobile ? 'bottom' : 'right'}
      size={mobile ? '100%' : 'md'}
      styles={mobile ? { content: { height: '100%' } } : undefined}
      overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
    >
      {opened && (
        <TransactionForm transaction={transaction} initialDraft={initialDraft} onSaved={onClose} />
      )}
    </Drawer>
  )
}
