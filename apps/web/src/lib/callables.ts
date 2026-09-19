import { httpsCallable } from 'firebase/functions'
import type {
  CreateAccountInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateHouseholdInput,
  CreateInvitationInput,
  TransactionInput,
  UpdateAccountInput,
  UpdateHouseholdInput,
  UpdateTransactionInput,
  CreateBankConnectionInput,
} from '@family-expense-tracker/shared'
import { functions } from './firebase'

async function call<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
  const callable = httpsCallable<TInput, TOutput>(functions, name)
  return (await callable(input)).data
}

export const api = {
  createHousehold: (input: CreateHouseholdInput) => call<typeof input, { householdId: string }>('createHousehold', input),
  createAccount: (input: CreateAccountInput) => call<typeof input, { accountId: string }>('createAccount', input),
  updateAccount: (input: UpdateAccountInput) => call<typeof input, { accountId: string }>('updateAccount', input),
  archiveAccount: (input: { householdId: string; accountId: string }) => call<typeof input, { accountId: string }>('archiveAccount', input),
  createTransaction: (input: TransactionInput) => call<typeof input, { transactionId: string }>(input.type === 'TRANSFER' ? 'createTransfer' : 'createTransaction', input),
  updateTransaction: (input: UpdateTransactionInput) => call<typeof input, { transactionId: string }>('updateTransaction', input),
  deleteTransaction: (input: { householdId: string; transactionId: string }) => call<typeof input, { transactionId: string }>('deleteTransaction', input),
  restoreTransaction: (input: { householdId: string; transactionId: string }) => call<typeof input, { transactionId: string }>('restoreTransaction', input),
  unlinkBankTransaction: (input: { householdId: string; transactionId: string }) => call<typeof input, { transactionId: string }>('unlinkBankTransaction', input),
  createCategory: (input: CreateCategoryInput) => call<typeof input, { categoryId: string }>('createCategory', input),
  updateCategory: (input: UpdateCategoryInput) => call<typeof input, { categoryId: string }>('updateCategory', input),
  createInvitation: (input: CreateInvitationInput) => call<typeof input, { invitationId: string }>('createInvitation', input),
  acceptInvitation: (input: { invitationId: string }) => call<typeof input, { invitationId: string }>('acceptInvitation', input),
  revokeInvitation: (input: { invitationId: string }) => call<typeof input, { invitationId: string }>('revokeInvitation', input),
  rebuildAnalytics: (input: { householdId: string }) => call<typeof input, { monthsRebuilt: number }>('rebuildMonthlyAnalytics', input),
  updateHousehold: (input: UpdateHouseholdInput) => call<typeof input, { householdId: string }>('updateHousehold', input),
  deleteHousehold: (input: { householdId: string; confirmationName: string }) => call<typeof input, { householdId: string }>('deleteHousehold', input),
  createBankConnection: (input: CreateBankConnectionInput) => call<typeof input, { connectionId: string; authorizationUrl: string }>('createBankConnection', input),
  syncBankConnection: (input: { householdId: string; connectionId: string }) => call<typeof input, { connectionId: string }>('syncBankConnection', input),
  reconnectBankConnection: (input: { householdId: string; connectionId: string; returnTo: string }) => call<typeof input, { authorizationUrl: string }>('reconnectBankConnection', input),
  disconnectBankConnection: (input: { householdId: string; connectionId: string }) => call<typeof input, { connectionId: string }>('disconnectBankConnection', input),
  reviewBankTransaction: (input: { householdId: string; bankTransactionId: string; action: 'MATCH' | 'CREATE_SEPARATELY' | 'IGNORE'; transactionId?: string; categoryId?: string }) => call<typeof input, { bankTransactionId: string }>('reviewBankTransaction', input),
  createMerchantRule: (input: { householdId: string; matcherType: 'EXACT' | 'CONTAINS' | 'STARTS_WITH'; pattern: string; categoryId: string; priority?: number }) => call<typeof input, { merchantRuleId: string }>('createMerchantRule', input),
}
