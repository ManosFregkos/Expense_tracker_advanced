import type {
  Category,
  FinancialAccount,
  HouseholdMember,
  Transaction,
} from '@family-expense-tracker/shared'
import { toDate } from '../lib/date'

function escape(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function transactionsToCsv(
  transactions: Transaction[],
  members: HouseholdMember[],
  accounts: FinancialAccount[],
  categories: Category[],
): string {
  const header = [
    'date',
    'type',
    'member',
    'account',
    'category',
    'description',
    'merchant',
    'amountMinor',
    'currency',
  ]
  const rows = transactions.map((transaction) => {
    const accountId =
      transaction.type === 'TRANSFER' ? transaction.transfer.sourceAccountId : transaction.accountId
    const destination =
      transaction.type === 'TRANSFER'
        ? accounts.find((item) => item.id === transaction.transfer.destinationAccountId)?.name
        : undefined
    return [
      toDate(transaction.transactionDate).toISOString(),
      transaction.type,
      transaction.type === 'TRANSFER'
        ? ''
        : (members.find((item) => item.userId === transaction.ownerUserId)?.displayName ?? ''),
      `${accounts.find((item) => item.id === accountId)?.name ?? ''}${destination ? ` -> ${destination}` : ''}`,
      transaction.type === 'TRANSFER'
        ? ''
        : (categories.find((item) => item.id === transaction.categoryId)?.name ?? ''),
      transaction.description,
      transaction.merchant ?? '',
      transaction.amountMinor,
      transaction.currency,
    ]
      .map(escape)
      .join(',')
  })
  return [header.join(','), ...rows].join('\n')
}

export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
