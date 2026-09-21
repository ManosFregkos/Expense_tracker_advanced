import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { HouseholdMember, HouseholdTask, TaskList } from '@family-expense-tracker/shared'
import { api } from '../../../lib/callables'
import { friendlyError } from '../../../lib/errors'
import { useHousehold } from '../../households/HouseholdProvider'
import { useInvalidateTasks } from '../hooks'
import { TaskRow } from './TaskRow'

export function TaskListView({
  tasks,
  members,
  lists,
  manualOrder,
  onOpen,
}: {
  tasks: HouseholdTask[]
  members: HouseholdMember[]
  lists: TaskList[]
  manualOrder: boolean
  onOpen(taskId: string): void
}) {
  const { household } = useHousehold()
  const invalidate = useInvalidateTasks()
  const [ordered, setOrdered] = useState(tasks)
  useEffect(() => setOrdered(tasks), [tasks])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const reorder = useMutation({
    mutationFn: (updates: HouseholdTask[]) =>
      api.reorderTasks({
        householdId: household!.id,
        tasks: updates.map((task) => ({
          taskId: task.id,
          sortOrder: task.sortOrder,
          expectedVersion: task.version,
        })),
      }),
    onSuccess: () => void invalidate(),
    onError: (error) => {
      setOrdered(tasks)
      notifications.show({ color: 'red', message: friendlyError(error) })
    },
  })
  const dragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return
    const oldIndex = ordered.findIndex((task) => task.id === event.active.id)
    const newIndex = ordered.findIndex((task) => task.id === event.over!.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(ordered, oldIndex, newIndex)
    const moved = next[newIndex]
    if (!moved) return
    const previous = next[newIndex - 1]
    const following = next[newIndex + 1]
    const sortOrder =
      previous && following
        ? (previous.sortOrder + following.sortOrder) / 2
        : previous
          ? previous.sortOrder + 1000
          : following
            ? following.sortOrder - 1000
            : 0
    const display = next.map((task) => (task.id === moved.id ? { ...task, sortOrder } : task))
    const anchors = [display[newIndex - 1], display[newIndex], display[newIndex + 1]].filter(
      (task): task is HouseholdTask => Boolean(task),
    )
    setOrdered(display)
    reorder.mutate(anchors)
  }
  if (!ordered.length)
    return (
      <Text c="dimmed" ta="center" py="xl">
        No tasks found.
      </Text>
    )
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <SortableContext
        items={ordered.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <Stack gap="xs">
          {ordered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              members={members}
              lists={lists}
              timeZone={household?.timeZone ?? 'UTC'}
              draggable={manualOrder}
              onOpen={() => onOpen(task.id)}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  )
}
