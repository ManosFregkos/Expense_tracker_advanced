import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  parseMoneyToMinor,
  transactionCoreSchema,
  type Transaction,
} from '@family-expense-tracker/shared'
import { useAccounts, useCategories, useMembers } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { localDateInputValue, localDateToIso, toDate } from '../../lib/date'
import { friendlyError } from '../../lib/errors'
import { accountKeys, analyticsKeys, transactionKeys } from '../../lib/query-keys'
import { useHousehold } from '../households/HouseholdProvider'

const formSchema = z
  .object({
    type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
    amount: z.string().min(1),
    accountId: z.string().optional(),
    ownerUserId: z.string().optional(),
    categoryId: z.string().optional(),
    sourceAccountId: z.string().optional(),
    destinationAccountId: z.string().optional(),
    description: z.string().trim().min(1).max(160),
    merchant: z.string().trim().max(160).optional(),
    date: z.string().min(1),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === 'TRANSFER') {
      if (!value.sourceAccountId)
        context.addIssue({
          code: 'custom',
          path: ['sourceAccountId'],
          message: 'Select a source account',
        })
      if (!value.destinationAccountId)
        context.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'Select a destination account',
        })
      if (value.sourceAccountId === value.destinationAccountId)
        context.addIssue({
          code: 'custom',
          path: ['destinationAccountId'],
          message: 'Accounts must differ',
        })
    } else
      for (const field of ['accountId', 'ownerUserId', 'categoryId'] as const)
        if (!value[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required' })
  })
type Values = z.infer<typeof formSchema>

function defaults(transaction?: Transaction): Values {
  const base = {
    amount: transaction ? String(transaction.amountMinor / 100) : '',
    description: transaction?.description ?? '',
    merchant: transaction?.merchant ?? '',
    date: transaction
      ? localDateInputValue(toDate(transaction.transactionDate))
      : localDateInputValue(),
    notes: transaction?.notes ?? '',
  }
  if (!transaction) return { ...base, type: 'EXPENSE' }
  if (transaction.type === 'TRANSFER')
    return {
      ...base,
      type: 'TRANSFER',
      sourceAccountId: transaction.transfer.sourceAccountId,
      destinationAccountId: transaction.transfer.destinationAccountId,
    }
  return {
    ...base,
    type: transaction.type,
    accountId: transaction.accountId,
    ownerUserId: transaction.ownerUserId,
    categoryId: transaction.categoryId,
  }
}

export function TransactionForm({
  transaction,
  onSaved,
}: {
  transaction?: Transaction
  onSaved(): void
}) {
  const { household } = useHousehold()
  const accounts = useAccounts()
  const members = useMembers()
  const categories = useCategories()
  const queryClient = useQueryClient()
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: defaults(transaction) })
  const type = watch('type')
  const activeAccounts = (accounts.data ?? []).filter((account) => !account.isArchived)
  const accountOptions = activeAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} · ${members.data?.find((member) => member.userId === account.ownerUserId)?.displayName ?? 'Member'}`,
  }))
  const categoryOptions = (categories.data ?? [])
    .filter((category) => category.type === type && !category.isArchived)
    .map((category) => {
      const parent = categories.data?.find(
        (candidate) => candidate.id === category.parentCategoryId,
      )
      return {
        value: category.id,
        label: parent ? `${parent.name} › ${category.name}` : category.name,
      }
    })
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (!household) throw new Error('No household selected')
      const common = {
        householdId: household.id,
        amountMinor: parseMoneyToMinor(values.amount, household.defaultCurrency),
        currency: household.defaultCurrency,
        description: values.description,
        ...(values.merchant ? { merchant: values.merchant } : {}),
        transactionDate: localDateToIso(values.date),
        ...(values.notes ? { notes: values.notes } : {}),
        source: 'MANUAL' as const,
      }
      const input =
        values.type === 'TRANSFER'
          ? {
              ...common,
              type: 'TRANSFER' as const,
              sourceAccountId: values.sourceAccountId!,
              destinationAccountId: values.destinationAccountId!,
            }
          : {
              ...common,
              type: values.type,
              accountId: values.accountId!,
              ownerUserId: values.ownerUserId!,
              categoryId: values.categoryId!,
            }
      return transaction
        ? api.updateTransaction({
            householdId: household.id,
            transactionId: transaction.id,
            transaction: transactionCoreSchema.parse(input),
          })
        : api.createTransaction(input)
    },
    onSuccess: async () => {
      if (!household) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionKeys.all(household.id) }),
        queryClient.invalidateQueries({ queryKey: accountKeys.all(household.id) }),
        queryClient.invalidateQueries({ queryKey: analyticsKeys.monthly(household.id) }),
      ])
      notifications.show({
        color: 'teal',
        title: transaction
          ? 'Transaction updated'
          : `${type === 'EXPENSE' ? 'Expense' : type === 'INCOME' ? 'Income' : 'Transfer'} saved`,
        message: 'Balances and analytics are up to date.',
      })
      onSaved()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        title: 'Could not save transaction',
        message: friendlyError(error),
      }),
  })
  return (
    <form onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}>
      <Stack gap="md">
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SegmentedControl
              fullWidth
              data={[
                { value: 'EXPENSE', label: 'Expense' },
                { value: 'INCOME', label: 'Income' },
                { value: 'TRANSFER', label: 'Transfer' },
              ]}
              {...field}
            />
          )}
        />
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <NumberInput
              label="Amount"
              aria-label="Amount"
              autoFocus
              size="lg"
              min={0.01}
              decimalScale={2}
              fixedDecimalScale
              prefix={`${household?.defaultCurrency ?? 'EUR'} `}
              value={field.value}
              onChange={(value) => field.onChange(String(value))}
              error={errors.amount?.message}
            />
          )}
        />
        {type === 'TRANSFER' ? (
          <Group grow align="start">
            <Controller
              name="sourceAccountId"
              control={control}
              render={({ field }) => (
                <Select
                  searchable
                  label="From account"
                  data={accountOptions}
                  error={errors.sourceAccountId?.message}
                  {...field}
                />
              )}
            />
            <Controller
              name="destinationAccountId"
              control={control}
              render={({ field }) => (
                <Select
                  searchable
                  label="To account"
                  data={accountOptions}
                  error={errors.destinationAccountId?.message}
                  {...field}
                />
              )}
            />
          </Group>
        ) : (
          <>
            <Controller
              name="accountId"
              control={control}
              render={({ field }) => (
                <Select
                  searchable
                  label="Account"
                  data={accountOptions}
                  error={errors.accountId?.message}
                  {...field}
                  onChange={(value) => {
                    field.onChange(value)
                    const account = activeAccounts.find((item) => item.id === value)
                    if (account) setValue('ownerUserId', account.ownerUserId)
                  }}
                />
              )}
            />
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  searchable
                  label="Category"
                  data={categoryOptions}
                  error={errors.categoryId?.message}
                  {...field}
                />
              )}
            />
            <Controller
              name="ownerUserId"
              control={control}
              render={({ field }) => (
                <Select
                  label={type === 'EXPENSE' ? 'Paid by' : 'Received by'}
                  data={(members.data ?? []).map((member) => ({
                    value: member.userId,
                    label: member.displayName,
                  }))}
                  error={errors.ownerUserId?.message}
                  {...field}
                />
              )}
            />
          </>
        )}
        <TextInput
          label={type === 'TRANSFER' ? 'Description' : 'Description / merchant'}
          placeholder={
            type === 'EXPENSE'
              ? 'e.g. Lidl'
              : type === 'INCOME'
                ? 'e.g. September salary'
                : 'e.g. Cash withdrawal'
          }
          error={errors.description?.message}
          {...register('description')}
        />
        {type !== 'TRANSFER' && <TextInput label="Merchant (optional)" {...register('merchant')} />}
        <TextInput label="Date" type="date" error={errors.date?.message} {...register('date')} />
        <Textarea label="Notes (optional)" autosize minRows={2} {...register('notes')} />
        <Button size="md" type="submit" loading={mutation.isPending}>
          Save {type === 'EXPENSE' ? 'expense' : type === 'INCOME' ? 'income' : 'transfer'}
        </Button>
      </Stack>
    </form>
  )
}
