import {
  ActionIcon,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconArchive, IconPlus } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  compareTaskPriority,
  dateKeyInTimeZone,
  isTaskOverdue,
  normalizeSearchText,
  type HouseholdTask,
  type TaskCoreInput,
} from '@family-expense-tracker/shared'
import { EmptyState } from '../../components/EmptyState'
import { useMembers } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { taskListKeys } from '../../lib/query-keys'
import type { TaskQueryFilters, TaskView } from '../../lib/repositories'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../households/HouseholdProvider'
import { TaskDetailsDrawer } from './components/TaskDetailsDrawer'
import { TaskForm } from './components/TaskForm'
import { TaskListView } from './components/TaskListView'
import { TaskQuickAdd } from './components/TaskQuickAdd'
import { useInvalidateTasks, useTaskLists, useTasks } from './hooks'

const VIEWS: TaskView[] = ['today', 'upcoming', 'all', 'completed']
const initializedHouseholds = new Set<string>()
type Scope = 'household' | 'me' | 'unassigned'
type Sort = 'manual' | 'due' | 'priority' | 'created' | 'updated'

export function TasksPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { household } = useHousehold()
  const { user } = useAuth()
  const members = useMembers()
  const lists = useTaskLists()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateTasks()
  const [createOpened, createDrawer] = useDisclosure(false)
  const mobile = useMediaQuery('(max-width: 48em)')
  const [listOpened, listModal] = useDisclosure(false)
  const [listName, setListName] = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [page, setPage] = useState(0)
  const [cursors, setCursors] = useState<Array<TaskQueryFilters['cursor']>>([undefined])
  const rawView = params.get('view') as TaskView | null
  const view = rawView && VIEWS.includes(rawView) ? rawView : 'today'
  const scope = (params.get('assignee') ?? 'household') as Scope
  const listId = params.get('list') ?? ''
  const priority = params.get('priority') ?? ''
  const search = params.get('q') ?? ''
  const sort = (params.get('sort') ?? (view === 'all' ? 'manual' : 'due')) as Sort
  const todayKey = dateKeyInTimeZone(new Date(), household?.timeZone ?? 'UTC')
  const result = useTasks(
    {
      view,
      todayKey,
      timeZone: household?.timeZone ?? 'UTC',
      pageSize: view === 'completed' ? 30 : 200,
      ...(cursors[page] ? { cursor: cursors[page] } : {}),
    },
    page,
  )
  useEffect(() => {
    if (!household || initializedHouseholds.has(household.id)) return
    initializedHouseholds.add(household.id)
    void api
      .initializeTaskModule({ householdId: household.id })
      .then(() => queryClient.invalidateQueries({ queryKey: taskListKeys.all(household.id) }))
      .catch(() => initializedHouseholds.delete(household.id))
  }, [household, queryClient])
  useEffect(() => {
    if (!household) return
    const flush = async () => {
      if (!navigator.onLine) return
      const key = 'offline-task-queue'
      const queued = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{
        householdId: string
        title: string
        clientRequestId: string
      }>
      const remaining = [...queued]
      for (const item of queued.filter((entry) => entry.householdId === household.id)) {
        try {
          await api.createTask({
            householdId: item.householdId,
            clientRequestId: item.clientRequestId,
            title: item.title,
            status: 'TODO',
            priority: 'NONE',
            tags: [],
          })
          const index = remaining.findIndex(
            (entry) => entry.clientRequestId === item.clientRequestId,
          )
          if (index >= 0) remaining.splice(index, 1)
        } catch {
          break
        }
      }
      localStorage.setItem(key, JSON.stringify(remaining))
      await invalidate()
    }
    window.addEventListener('online', flush)
    void flush()
    return () => window.removeEventListener('online', flush)
  }, [household, invalidate])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault()
        createDrawer.open()
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [createDrawer])
  const updateParam = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
    setPage(0)
    setCursors([undefined])
  }
  const filtered = useMemo(() => {
    let tasks = [...(result.data?.tasks ?? [])]
    if (scope === 'unassigned') tasks = tasks.filter((task) => !task.assigneeUserId)
    if (scope === 'me') tasks = tasks.filter((task) => task.assigneeUserId === user?.uid)
    if (listId) tasks = tasks.filter((task) => task.listId === listId)
    if (priority) tasks = tasks.filter((task) => task.priority === priority)
    const token = normalizeSearchText(search)
    if (token)
      tasks = tasks.filter((task) => {
        const listName = lists.data?.find((list) => list.id === task.listId)?.name ?? ''
        return normalizeSearchText(
          [task.title, task.description, listName, ...task.tags].filter(Boolean).join(' '),
        ).includes(token)
      })
    if (sort === 'priority') tasks.sort((a, b) => compareTaskPriority(a.priority, b.priority))
    else if (sort === 'created')
      tasks.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
    else if (sort === 'updated')
      tasks.sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt))
    else if (sort === 'manual') tasks.sort((a, b) => a.sortOrder - b.sortOrder)
    else
      tasks.sort(
        (a, b) =>
          (a.dueAt ? dateValue(a.dueAt) : Number.MAX_SAFE_INTEGER) -
          (b.dueAt ? dateValue(b.dueAt) : Number.MAX_SAFE_INTEGER),
      )
    return tasks
  }, [listId, lists.data, priority, result.data?.tasks, scope, search, sort, user?.uid])
  const create = useMutation({
    mutationFn: (values: TaskCoreInput) =>
      api.createTask({
        householdId: household!.id,
        clientRequestId: crypto.randomUUID(),
        ...values,
      }),
    onSuccess: async ({ taskId: createdId }) => {
      createDrawer.close()
      await invalidate(createdId)
      void navigate(`/tasks/${createdId}${window.location.search}`)
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const createList = useMutation({
    mutationFn: () => api.createTaskList({ householdId: household!.id, name: listName }),
    onSuccess: async () => {
      setListName('')
      listModal.close()
      await queryClient.invalidateQueries({ queryKey: taskListKeys.all(household!.id) })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const archiveList = useMutation({
    mutationFn: (taskListId: string) =>
      api.archiveTaskList({ householdId: household!.id, taskListId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskListKeys.all(household!.id) })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  if (!household) return null
  return (
    <div className="page safe-bottom">
      <div className="page-header">
        <div>
          <Title order={1}>Tasks</Title>
          <Text c="dimmed">Keep household work visible and moving.</Text>
        </div>
        <Button leftSection={<IconPlus size={17} />} onClick={createDrawer.open}>
          Add task
        </Button>
      </div>
      <Paper withBorder p="md" mb="lg">
        <TaskQuickAdd onCreated={(id) => void navigate(`/tasks/${id}${window.location.search}`)} />
      </Paper>
      <Stack gap="md">
        <Select
          className="task-view-select"
          aria-label="Task view"
          value={view}
          onChange={(value) => value && updateParam('view', value)}
          data={VIEWS.map((item) => ({
            value: item,
            label: item[0]!.toUpperCase() + item.slice(1),
          }))}
        />
        <div className="segment-scroll task-view-tabs">
          <SegmentedControl
            fullWidth
            miw={350}
            value={view}
            onChange={(value) => updateParam('view', value)}
            data={VIEWS.map((item) => ({
              value: item,
              label: item[0]!.toUpperCase() + item.slice(1),
            }))}
          />
        </div>
        <SimpleGrid
          className="filter-grid"
          data-expanded={filtersExpanded}
          cols={{ base: 1, xs: 2, md: 3, lg: 5 }}
          spacing="sm"
        >
          <TextInput
            label="Search"
            placeholder="Title, description, list, or tag"
            value={search}
            onChange={(event) => updateParam('q', event.currentTarget.value)}
          />
          <Select
            label="Responsibility"
            value={scope}
            onChange={(value) => updateParam('assignee', value ?? 'household')}
            data={[
              { value: 'household', label: 'Household' },
              { value: 'me', label: 'My tasks' },
              { value: 'unassigned', label: 'Unassigned' },
            ]}
          />
          <Button
            className="mobile-only filter-toggle"
            variant="light"
            aria-expanded={filtersExpanded}
            onClick={() => setFiltersExpanded((current) => !current)}
          >
            {filtersExpanded
              ? 'Hide filters'
              : `More filters${listId || priority || params.get('sort') ? ' • active' : ''}`}
          </Button>
          <div className="filter-extra">
            <Select
              label="List"
              clearable
              value={listId || null}
              onChange={(value) => updateParam('list', value ?? '')}
              data={(lists.data ?? [])
                .filter((list) => !list.isArchived)
                .map((list) => ({ value: list.id, label: list.name }))}
            />
            <Select
              label="Priority"
              clearable
              value={priority || null}
              onChange={(value) => updateParam('priority', value ?? '')}
              data={['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']}
            />
            <Select
              label="Sort"
              value={sort}
              onChange={(value) => updateParam('sort', value ?? 'due')}
              data={[
                { value: 'manual', label: 'Manual order' },
                { value: 'due', label: 'Due date' },
                { value: 'priority', label: 'Priority' },
                { value: 'created', label: 'Created' },
                { value: 'updated', label: 'Recently updated' },
              ]}
            />
          </div>
        </SimpleGrid>
        <Group justify="flex-end" className="task-list-actions">
          <Button variant="subtle" size="xs" onClick={listModal.open}>
            + Create list
          </Button>
        </Group>
      </Stack>
      <div style={{ marginTop: 20 }}>
        {result.isLoading ? (
          <Loader />
        ) : filtered.length ? (
          <TaskGroups
            tasks={filtered}
            view={view}
            todayKey={todayKey}
            timeZone={household.timeZone}
            members={members.data ?? []}
            lists={lists.data ?? []}
            manualOrder={
              view === 'all' &&
              sort === 'manual' &&
              !search &&
              scope === 'household' &&
              !listId &&
              !priority
            }
            onOpen={(id) => void navigate(`/tasks/${id}${window.location.search}`)}
          />
        ) : (
          <EmptyState
            title={
              view === 'today'
                ? 'No tasks for today'
                : view === 'completed'
                  ? 'No completed tasks yet'
                  : 'No tasks found'
            }
            message={
              view === 'today' ? 'Enjoy the clear schedule.' : 'Add a task or adjust the filters.'
            }
            actionLabel="Add task"
            onAction={createDrawer.open}
          />
        )}
      </div>
      {result.data?.tasks.length && (page > 0 || result.data.hasMore) ? (
        <Group justify="flex-end" mt="lg">
          <Button
            variant="default"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Text size="sm">Page {page + 1}</Text>
          <Button
            variant="default"
            disabled={!result.data.hasMore}
            onClick={() => {
              setCursors((current) => {
                const next = [...current]
                next[page + 1] = result.data?.cursor
                return next
              })
              setPage((value) => value + 1)
            }}
          >
            Next
          </Button>
        </Group>
      ) : null}
      <ActionIcon
        className="mobile-only task-fab"
        size={54}
        radius="xl"
        aria-label="Add task"
        onClick={createDrawer.open}
      >
        <IconPlus />
      </ActionIcon>
      <Drawer
        opened={createOpened}
        onClose={createDrawer.close}
        title="Add task"
        position={mobile ? 'bottom' : 'right'}
        size={mobile ? '100%' : 'lg'}
        styles={mobile ? { content: { height: '100%' } } : undefined}
      >
        <TaskForm submitting={create.isPending} onSubmit={(values) => create.mutate(values)} />
      </Drawer>
      <TaskDetailsDrawer
        taskId={taskId}
        onClose={() => void navigate(`/tasks${window.location.search}`)}
      />
      <Modal opened={listOpened} onClose={listModal.close} title="Create task list" centered>
        <Stack>
          {(lists.data ?? [])
            .filter((list) => !list.isArchived)
            .map((list) => (
              <Group key={list.id} justify="space-between">
                <Text>{list.name}</Text>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Archive ${list.name}`}
                  onClick={() => archiveList.mutate(list.id)}
                >
                  <IconArchive size={17} />
                </ActionIcon>
              </Group>
            ))}
          <TextInput
            label="List name"
            placeholder="e.g. Child"
            value={listName}
            maxLength={80}
            onChange={(event) => setListName(event.currentTarget.value)}
          />
          <Button
            disabled={!listName.trim()}
            loading={createList.isPending}
            onClick={() => createList.mutate()}
          >
            Create list
          </Button>
        </Stack>
      </Modal>
    </div>
  )
}

function dateValue(value: HouseholdTask['createdAt']) {
  return (value instanceof Date ? value : value.toDate()).getTime()
}

function TaskGroups({
  tasks,
  view,
  todayKey,
  timeZone,
  members,
  lists,
  manualOrder,
  onOpen,
}: {
  tasks: HouseholdTask[]
  view: TaskView
  todayKey: string
  timeZone: string
  members: Parameters<typeof TaskListView>[0]['members']
  lists: Parameters<typeof TaskListView>[0]['lists']
  manualOrder: boolean
  onOpen(id: string): void
}) {
  if (view === 'today') {
    const overdue = tasks.filter((task) => isTaskOverdue(task, new Date(), timeZone))
    const today = tasks.filter((task) => task.dueDate === todayKey && !overdue.includes(task))
    return (
      <Stack>
        {overdue.length > 0 && (
          <TaskGroup
            title="Overdue"
            tasks={overdue}
            {...{ members, lists, manualOrder: false, onOpen }}
          />
        )}
        {today.length > 0 && (
          <TaskGroup
            title="Today"
            tasks={today}
            {...{ members, lists, manualOrder: false, onOpen }}
          />
        )}
      </Stack>
    )
  }
  if (view === 'upcoming') {
    const grouped = tasks.reduce((result, task) => {
      const key = task.dueDate ?? 'Later'
      result.set(key, [...(result.get(key) ?? []), task])
      return result
    }, new Map<string, HouseholdTask[]>())
    return (
      <Stack>
        {[...grouped.entries()].map(([date, items]) => (
          <TaskGroup
            key={date}
            title={date}
            tasks={items}
            {...{ members, lists, manualOrder: false, onOpen }}
          />
        ))}
      </Stack>
    )
  }
  return (
    <TaskListView
      tasks={tasks}
      members={members}
      lists={lists}
      manualOrder={manualOrder}
      onOpen={onOpen}
    />
  )
}

function TaskGroup({
  title,
  tasks,
  members,
  lists,
  manualOrder,
  onOpen,
}: {
  title: string
  tasks: HouseholdTask[]
  members: Parameters<typeof TaskListView>[0]['members']
  lists: Parameters<typeof TaskListView>[0]['lists']
  manualOrder: boolean
  onOpen(id: string): void
}) {
  return (
    <section>
      <Text tt="uppercase" size="xs" fw={700} c="dimmed" mb="xs">
        {title}
      </Text>
      <TaskListView
        tasks={tasks}
        members={members}
        lists={lists}
        manualOrder={manualOrder}
        onOpen={onOpen}
      />
    </section>
  )
}
