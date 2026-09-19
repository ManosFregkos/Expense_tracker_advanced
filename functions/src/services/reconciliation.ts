import { createHash } from 'node:crypto'
import {
  normalizeSearchText,
  type BankTransaction,
  type Transaction,
} from '@family-expense-tracker/shared'

function toDate(
  value: BankTransaction['bookingDate'] | Transaction['transactionDate'],
): Date | undefined {
  if (!value) return undefined
  return value instanceof Date ? value : value.toDate()
}

function merchant(
  value:
    | Pick<BankTransaction, 'merchantName' | 'rawDescription'>
    | Pick<Transaction, 'merchant' | 'description'>,
): string {
  return normalizeSearchText(
    'rawDescription' in value
      ? (value.merchantName ?? value.rawDescription)
      : (value.merchant ?? value.description),
  )
}

function tokens(value: string): Set<string> {
  return new Set(value.split(' ').filter((token) => token.length >= 3))
}

export function merchantSimilarity(left: string, right: string): number {
  if (left === right) return 1
  const a = tokens(left)
  const b = tokens(right)
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const token of a)
    if (b.has(token) || [...b].some((other) => other.startsWith(token) || token.startsWith(other)))
      intersection += 1
  return intersection / Math.max(a.size, b.size)
}

export function transactionFingerprint(input: {
  accountId: string
  amountMinor: number
  currency: string
  merchant: string
  date?: Date
  direction: string
}): string {
  const day = input.date ? input.date.toISOString().slice(0, 10) : 'unknown'
  return createHash('sha256')
    .update(
      [
        input.accountId,
        Math.abs(input.amountMinor),
        input.currency.toUpperCase(),
        normalizeSearchText(input.merchant),
        day,
        input.direction,
      ].join('\u0000'),
    )
    .digest('hex')
}

export interface ReconciliationScore {
  score: number
  reasons: string[]
}

export class TransactionReconciliationService {
  static readonly HIGH_CONFIDENCE = 90
  static readonly REVIEW_CONFIDENCE = 70

  scoreCandidate(bank: BankTransaction, candidate: Transaction): ReconciliationScore {
    const reasons: string[] = []
    let score = 0
    const accountId = bank.accountId
    if (candidate.type !== 'TRANSFER' && accountId && candidate.accountId === accountId) {
      score += 40
      reasons.push('same account')
    }
    if (candidate.amountMinor === bank.amountMinor) {
      score += 35
      reasons.push('same amount')
    }
    if (candidate.currency === bank.currency) {
      score += 5
      reasons.push('same currency')
    }
    const bankDate = toDate(bank.bookingDate ?? bank.transactionDate)
    const manualDate = toDate(candidate.transactionDate)
    if (bankDate && manualDate) {
      const days = Math.abs(bankDate.getTime() - manualDate.getTime()) / 86_400_000
      if (days < 1) {
        score += 15
        reasons.push('same day')
      } else if (days <= 1.5) {
        score += 10
        reasons.push('adjacent day')
      }
    }
    const similarity = merchantSimilarity(merchant(bank), merchant(candidate))
    if (similarity >= 0.75) {
      score += 10
      reasons.push('similar merchant')
    } else if (similarity >= 0.4) {
      score += 5
      reasons.push('possibly similar merchant')
    }
    return { score, reasons }
  }

  findCandidates(
    bank: BankTransaction,
    transactions: readonly Transaction[],
  ): Array<{ transaction: Transaction; score: ReconciliationScore }> {
    return transactions
      .filter(
        (candidate) =>
          !candidate.isDeleted && !candidate.bankTransactionId && candidate.type !== 'TRANSFER',
      )
      .map((transaction) => ({ transaction, score: this.scoreCandidate(bank, transaction) }))
      .filter((result) => result.score.score >= TransactionReconciliationService.REVIEW_CONFIDENCE)
      .sort(
        (a, b) => b.score.score - a.score.score || a.transaction.id.localeCompare(b.transaction.id),
      )
  }

  reconcileAutomatically(
    bank: BankTransaction,
    transactions: readonly Transaction[],
  ): { action: 'AUTO_MATCH' | 'REVIEW' | 'CREATE'; transactionId?: string; score?: number } {
    const candidates = this.findCandidates(bank, transactions)
    const best = candidates[0]
    if (!best) return { action: 'CREATE' }
    const second = candidates[1]
    if (
      best.score.score >= TransactionReconciliationService.HIGH_CONFIDENCE &&
      (!second || best.score.score - second.score.score >= 10)
    )
      return { action: 'AUTO_MATCH', transactionId: best.transaction.id, score: best.score.score }
    return { action: 'REVIEW', transactionId: best.transaction.id, score: best.score.score }
  }
}

export function matchesMerchantRule(
  normalizedMerchant: string,
  rule: {
    normalizedPattern?: string
    pattern: string
    matcherType: 'EXACT' | 'CONTAINS' | 'STARTS_WITH'
    enabled?: boolean
  },
): boolean {
  if (rule.enabled === false) return false
  const pattern = rule.normalizedPattern ?? normalizeSearchText(rule.pattern)
  if (rule.matcherType === 'EXACT') return normalizedMerchant === pattern
  if (rule.matcherType === 'STARTS_WITH') return normalizedMerchant.startsWith(pattern)
  return normalizedMerchant.includes(pattern)
}
