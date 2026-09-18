import { zodResolver } from '@hookform/resolvers/zod'
import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCategories } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { friendlyError } from '../../lib/errors'
import { categoryKeys } from '../../lib/query-keys'
import { useHousehold } from '../households/HouseholdProvider'

const schema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(['EXPENSE', 'INCOME']),
  parentCategoryId: z.string().optional(),
})
type Values = z.infer<typeof schema>
export function CategoriesPage() {
  const { household } = useHousehold()
  const categories = useCategories()
  const [opened, modal] = useDisclosure(false)
  const queryClient = useQueryClient()
  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { type: 'EXPENSE' } })
  const type = watch('type')
  const create = useMutation({
    mutationFn: (values: Values) =>
      api.createCategory({
        householdId: household!.id,
        name: values.name,
        type: values.type,
        ...(values.parentCategoryId ? { parentCategoryId: values.parentCategoryId } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all(household!.id) })
      reset()
      modal.close()
      notifications.show({ color: 'teal', message: 'Category created.' })
    },
    onError: (error) => notifications.show({ color: 'red', message: friendlyError(error) }),
  })
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Title order={1}>Categories</Title>
          <Text c="dimmed">System defaults and household-specific categories.</Text>
        </div>
        <Button onClick={modal.open}>Add category</Button>
      </div>
      <Stack>
        {['EXPENSE', 'INCOME'].map((categoryType) => (
          <section key={categoryType}>
            <Title order={3} mb="sm">
              {categoryType === 'EXPENSE' ? 'Expense categories' : 'Income categories'}
            </Title>
            <Paper withBorder>
              {(categories.data ?? [])
                .filter((category) => category.type === categoryType && !category.parentCategoryId)
                .map((parent) => (
                  <div
                    key={parent.id}
                    style={{ padding: '14px 18px', borderBottom: '1px solid #edf0ef' }}
                  >
                    <Group justify="space-between">
                      <Text fw={700}>{parent.name}</Text>
                      {parent.isSystem && (
                        <Badge variant="light" color="gray">
                          System
                        </Badge>
                      )}
                    </Group>
                    {(categories.data ?? [])
                      .filter((child) => child.parentCategoryId === parent.id)
                      .map((child) => (
                        <Text key={child.id} pl="lg" pt={8} size="sm" c="dimmed">
                          {child.name}
                        </Text>
                      ))}
                  </div>
                ))}
            </Paper>
          </section>
        ))}
      </Stack>
      <Modal opened={opened} onClose={modal.close} title="Add category">
        <form onSubmit={(event) => void handleSubmit((values) => create.mutate(values))(event)}>
          <Stack>
            <TextInput label="Name" autoFocus error={errors.name?.message} {...register('name')} />
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select label="Type" data={['EXPENSE', 'INCOME']} {...field} />
              )}
            />
            <Controller
              name="parentCategoryId"
              control={control}
              render={({ field }) => (
                <Select
                  searchable
                  clearable
                  label="Parent (optional)"
                  data={(categories.data ?? [])
                    .filter((category) => category.type === type && !category.parentCategoryId)
                    .map((category) => ({ value: category.id, label: category.name }))}
                  {...field}
                />
              )}
            />
            <Button type="submit" loading={create.isPending}>
              Create category
            </Button>
          </Stack>
        </form>
      </Modal>
    </div>
  )
}
