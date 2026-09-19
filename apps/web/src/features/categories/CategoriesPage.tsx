import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Badge,
  Button,
  ColorInput,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'
import { IconArchive, IconEdit } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'
import type { Category } from '@family-expense-tracker/shared'
import { useCategories } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { categoryKeys } from '../../lib/query-keys'
import { useHousehold } from '../households/HouseholdProvider'

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(['EXPENSE', 'INCOME']),
  parentCategoryId: z.string().optional(),
  icon: z.string().trim().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal('')),
})
type Values = z.infer<typeof schema>

export function CategoriesPage() {
  const { household } = useHousehold()
  const categories = useCategories()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [editing, setEditing] = useState<Category>()
  const [opened, modal] = useDisclosure(false)
  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { type: tab } })
  const type = watch('type')
  const save = useMutation({
    mutationFn: (values: Values) =>
      editing
        ? api.updateCategory({
            householdId: household!.id,
            categoryId: editing.id,
            name: values.name,
            type: values.type,
            ...(values.parentCategoryId ? { parentCategoryId: values.parentCategoryId } : {}),
            ...(values.icon ? { icon: values.icon } : {}),
            ...(values.color ? { color: values.color } : {}),
          })
        : api.createCategory({
            householdId: household!.id,
            name: values.name,
            type: values.type,
            ...(values.parentCategoryId ? { parentCategoryId: values.parentCategoryId } : {}),
            ...(values.icon ? { icon: values.icon } : {}),
            ...(values.color ? { color: values.color } : {}),
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all(household!.id) })
      modal.close()
      setEditing(undefined)
      notifications.show({ color: 'teal', message: 'Category saved.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const archive = useMutation({
    mutationFn: (category: Category) =>
      api.updateCategory({
        householdId: household!.id,
        categoryId: category.id,
        name: category.name,
        type: category.type,
        ...(category.parentCategoryId ? { parentCategoryId: category.parentCategoryId } : {}),
        ...(category.icon ? { icon: category.icon } : {}),
        ...(category.color ? { color: category.color } : {}),
        isArchived: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all(household!.id) })
      notifications.show({ message: 'Category archived. Existing transactions keep it.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  const openCreate = () => {
    setEditing(undefined)
    reset({ type: tab, name: '', parentCategoryId: undefined, icon: '', color: '' })
    modal.open()
  }
  const openEdit = (category: Category) => {
    setEditing(category)
    reset({
      type: category.type,
      name: category.name,
      parentCategoryId: category.parentCategoryId,
      icon: category.icon ?? '',
      color: category.color ?? '',
    })
    modal.open()
  }
  const visible = (categories.data ?? []).filter(
    (category) => category.type === tab && !category.isArchived,
  )
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Categories</Title>
          <Text c="dimmed">
            System defaults and household-specific expense and income categories.
          </Text>
        </div>
        <Button onClick={openCreate}>Create category</Button>
      </div>
      <SegmentedControl
        mb="lg"
        value={tab}
        onChange={(value) => setTab(value as 'EXPENSE' | 'INCOME')}
        data={[
          { value: 'EXPENSE', label: 'Expenses' },
          { value: 'INCOME', label: 'Income' },
        ]}
      />
      {(['SYSTEM', 'CUSTOM'] as const).map((origin) => (
        <section key={origin}>
          <Title order={3} mt="lg" mb="sm">
            {origin === 'SYSTEM' ? 'System' : 'Custom'}
          </Title>
          <Paper withBorder>
            {visible
              .filter(
                (category) =>
                  (category.origin ?? (category.isSystem ? 'SYSTEM' : 'CUSTOM')) === origin &&
                  !category.parentCategoryId,
              )
              .map((parent) => (
                <div
                  key={parent.id}
                  style={{ padding: '14px 18px', borderBottom: '1px solid #edf0ef' }}
                >
                  <Group justify="space-between">
                    <Group>
                      <Text fw={700}>{parent.name}</Text>
                      {parent.isArchived && <Badge>Archived</Badge>}
                    </Group>
                    {origin === 'CUSTOM' && (
                      <Group>
                        <ActionIcon
                          variant="subtle"
                          aria-label={`Edit ${parent.name}`}
                          onClick={() => openEdit(parent)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Archive ${parent.name}`}
                          onClick={() => archive.mutate(parent)}
                        >
                          <IconArchive size={16} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
                  {visible
                    .filter((child) => child.parentCategoryId === parent.id)
                    .map((child) => (
                      <Group key={child.id} justify="space-between" pl="lg" pt={8}>
                        <Text size="sm" c="dimmed">
                          {child.name}
                        </Text>
                        {!child.isSystem && (
                          <Group>
                            <ActionIcon variant="subtle" onClick={() => openEdit(child)}>
                              <IconEdit size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => archive.mutate(child)}
                            >
                              <IconArchive size={14} />
                            </ActionIcon>
                          </Group>
                        )}
                      </Group>
                    ))}
                </div>
              ))}
          </Paper>
        </section>
      ))}
      <Modal
        opened={opened}
        onClose={modal.close}
        title={editing ? 'Edit category' : 'Create category'}
      >
        <form onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}>
          <Stack>
            <TextInput label="Name" autoFocus error={errors.name?.message} {...register('name')} />
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select
                  label="Type"
                  disabled={Boolean(editing)}
                  data={['EXPENSE', 'INCOME']}
                  {...field}
                />
              )}
            />
            <Controller
              name="parentCategoryId"
              control={control}
              render={({ field }) => (
                <Select
                  searchable
                  clearable
                  label="Parent category (optional)"
                  data={(categories.data ?? [])
                    .filter(
                      (category) =>
                        category.type === type &&
                        !category.parentCategoryId &&
                        category.id !== editing?.id &&
                        !category.isArchived,
                    )
                    .map((category) => ({ value: category.id, label: category.name }))}
                  {...field}
                />
              )}
            />
            <TextInput label="Icon (optional)" {...register('icon')} />
            <Controller
              name="color"
              control={control}
              render={({ field }) => <ColorInput label="Color (optional)" {...field} />}
            />
            <Button type="submit" loading={save.isPending}>
              Save category
            </Button>
          </Stack>
        </form>
      </Modal>
    </div>
  )
}
