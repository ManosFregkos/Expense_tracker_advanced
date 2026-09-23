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
export const taskKeys = {
  all: (householdId: string) => ['tasks', householdId] as const,
  list: (householdId: string, filters: object) => ['tasks', householdId, 'list', filters] as const,
  detail: (householdId: string, taskId: string) => ['tasks', householdId, 'detail', taskId] as const,
  subtasks: (householdId: string, taskId: string) =>
    ['tasks', householdId, 'detail', taskId, 'subtasks'] as const,
  activity: (householdId: string, taskId: string) =>
    ['tasks', householdId, 'detail', taskId, 'activity'] as const,
  dueCount: (householdId: string) => ['tasks', householdId, 'due-count'] as const,
}
export const taskListKeys = {
  all: (householdId: string) => ['task-lists', householdId] as const,
}
export const taskNotificationKeys = {
  all: (userId: string) => ['task-notifications', userId] as const,
  settings: (userId: string, householdId: string) =>
    ['task-notifications', userId, 'settings', householdId] as const,
}
export const kidsKeys = {
  profiles: (householdId: string) => ['kids', householdId, 'profiles'] as const,
  settings: (householdId: string, profileId: string) =>
    ['kids', householdId, 'settings', profileId] as const,
  progress: (householdId: string, profileId: string) =>
    ['kids', householdId, 'progress', profileId] as const,
  sessions: (householdId: string, profileId: string) =>
    ['kids', householdId, 'sessions', profileId] as const,
}
