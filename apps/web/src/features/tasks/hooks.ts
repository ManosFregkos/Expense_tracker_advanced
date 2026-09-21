import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { dateKeyInTimeZone, type HouseholdTask } from '@family-expense-tracker/shared'
import { useCallback } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../households/HouseholdProvider'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { taskKeys, taskListKeys, taskNotificationKeys } from '../../lib/query-keys'
import {
  getTask,
  getTaskNotificationSettings,
  listSubtasks,
  listTaskActivity,
  listTaskLists,
  listTaskNotifications,
  listTasks,
  taskDueCount,
  type TaskQueryFilters,
} from '../../lib/repositories'

export function useTasks(filters: TaskQueryFilters, page = 0) {
  const { household } = useHousehold()
  return useQuery({
    queryKey: taskKeys.list(household?.id ?? '', { ...filters, page }),
    queryFn: () => listTasks(household!.id, filters),
    enabled: Boolean(household),
  })
}

export function useTask(taskId?: string) {
  const { household } = useHousehold()
  return useQuery({
    queryKey: taskKeys.detail(household?.id ?? '', taskId ?? ''),
    queryFn: () => getTask(household!.id, taskId!),
    enabled: Boolean(household && taskId),
  })
}

export function useTaskLists() {
  const { household } = useHousehold()
  return useQuery({
    queryKey: taskListKeys.all(household?.id ?? ''),
    queryFn: () => listTaskLists(household!.id),
    enabled: Boolean(household),
  })
}

export function useSubtasks(taskId?: string) {
  const { household } = useHousehold()
  return useQuery({
    queryKey: taskKeys.subtasks(household?.id ?? '', taskId ?? ''),
    queryFn: () => listSubtasks(household!.id, taskId!),
    enabled: Boolean(household && taskId),
  })
}

export function useTaskActivity(taskId?: string) {
  const { household } = useHousehold()
  return useQuery({
    queryKey: taskKeys.activity(household?.id ?? '', taskId ?? ''),
    queryFn: () => listTaskActivity(household!.id, taskId!),
    enabled: Boolean(household && taskId),
  })
}

export function useTaskDueCount() {
  const { household } = useHousehold()
  const todayKey = household ? dateKeyInTimeZone(new Date(), household.timeZone) : ''
  return useQuery({
    queryKey: taskKeys.dueCount(household?.id ?? ''),
    queryFn: () => taskDueCount(household!.id, todayKey, household!.timeZone),
    enabled: Boolean(household),
  })
}

export function useTaskNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskNotificationKeys.all(user?.uid ?? ''),
    queryFn: () => listTaskNotifications(user!.uid),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  })
}

export function useTaskNotificationSettings() {
  const { user } = useAuth()
  const { household } = useHousehold()
  return useQuery({
    queryKey: taskNotificationKeys.settings(user?.uid ?? '', household?.id ?? ''),
    queryFn: () => getTaskNotificationSettings(user!.uid, household!.id),
    enabled: Boolean(user && household),
  })
}

interface TaskPageData {
  tasks: HouseholdTask[]
  cursor?: unknown
  hasMore: boolean
}

function optimisticStatus(value: unknown, taskId: string, status: HouseholdTask['status']) {
  if (!value || typeof value !== 'object' || !('tasks' in value)) return value
  const page = value as TaskPageData
  return {
    ...page,
    tasks: page.tasks.map((task) =>
      task.id === taskId ? { ...task, status, version: task.version + 1 } : task,
    ),
  }
}

export function useTaskStatusMutation(task: HouseholdTask) {
  const { household } = useHousehold()
  const queryClient = useQueryClient()
  const target = task.status === 'DONE' ? 'TODO' : 'DONE'
  return useMutation({
    mutationFn: () =>
      target === 'DONE'
        ? api.completeTask({ householdId: household!.id, taskId: task.id })
        : api.reopenTask({ householdId: household!.id, taskId: task.id }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(household!.id) })
      const previous = queryClient.getQueriesData({ queryKey: taskKeys.all(household!.id) })
      queryClient.setQueriesData({ queryKey: taskKeys.all(household!.id) }, (value) =>
        optimisticStatus(value, task.id, target),
      )
      return { previous }
    },
    onError: (error, _variables, context) => {
      context?.previous.forEach(([key, value]) => queryClient.setQueryData(key, value))
      notifications.show({ color: 'red', message: friendlyError(error) })
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.all(household!.id) }),
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(household!.id, task.id) }),
        queryClient.invalidateQueries({ queryKey: taskKeys.dueCount(household!.id) }),
      ])
    },
  })
}

export function useInvalidateTasks() {
  const { household } = useHousehold()
  const queryClient = useQueryClient()
  return useCallback(
    async (taskId?: string) => {
      if (!household) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.all(household.id) }),
        queryClient.invalidateQueries({ queryKey: taskKeys.dueCount(household.id) }),
        ...(taskId
          ? [queryClient.invalidateQueries({ queryKey: taskKeys.detail(household.id, taskId) })]
          : []),
      ])
    },
    [household, queryClient],
  )
}
