export const householdKeys = {
  all: ['households'] as const,
  detail: (id: string) => ['households', id] as const,
  members: (id: string) => ['households', id, 'members'] as const,
}
export const accountKeys = { all: (householdId: string) => ['accounts', householdId] as const }
export const categoryKeys = { all: (householdId: string) => ['categories', householdId] as const }
export const transactionKeys = {
  all: (householdId: string) => ['transactions', householdId] as const,
  list: (householdId: string, filters: object) => ['transactions', householdId, 'list', filters] as const,
  detail: (householdId: string, id: string) => ['transactions', householdId, id] as const,
}
export const analyticsKeys = { monthly: (householdId: string) => ['analytics', householdId, 'monthly'] as const }
export const invitationKeys = { mine: (email: string) => ['invitations', email] as const }
export const bankingKeys = {
  connections: (householdId: string) => ['banking', householdId, 'connections'] as const,
  review: (householdId: string) => ['banking', householdId, 'review'] as const,
  pending: (householdId: string) => ['banking', householdId, 'pending'] as const,
}
