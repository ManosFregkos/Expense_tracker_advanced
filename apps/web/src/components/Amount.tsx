import { Text, type TextProps } from '@mantine/core'
import { formatMoney, type TransactionType } from '@family-expense-tracker/shared'

export function Amount({
  amountMinor,
  currency,
  type,
  ...props
}: { amountMinor: number; currency: string; type?: TransactionType } & TextProps) {
  const sign = type === 'EXPENSE' ? -1 : 1
  return (
    <Text fw={650} className={type ? `amount-${type.toLowerCase()}` : undefined} {...props}>
      {type === 'TRANSFER'
        ? formatMoney(amountMinor, currency)
        : formatMoney(amountMinor * sign, currency)}
    </Text>
  )
}
