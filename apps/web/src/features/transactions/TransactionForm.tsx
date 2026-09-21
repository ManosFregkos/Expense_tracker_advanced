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
import { useEffect, useState } from 'react'
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
    tags: z.string().max(1200),
    splits: z
      .array(z.object({ id: z.string(), categoryId: z.string().min(1), amount: z.string().min(1) }))
      .max(20)
      .optional(),
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
type ManualSuggestion = {
  merchant: string
  type: 'EXPENSE' | 'INCOME'
  accountId: string
  ownerUserId: string
  categoryId: string
}

function loadSuggestions(): ManualSuggestion[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('manualTransactionSuggestions') ?? '[]')
    if (!Array.isArray(value)) return []
    const items = value as unknown[]
    return items
      .filter(
        (item): item is ManualSuggestion =>
          item !== null &&
          typeof item === 'object' &&
          'merchant' in item &&
          typeof item.merchant === 'string' &&
          'type' in item &&
          (item.type === 'EXPENSE' || item.type === 'INCOME') &&
          'accountId' in item &&
          typeof item.accountId === 'string' &&
          'ownerUserId' in item &&
          typeof item.ownerUserId === 'string' &&
          'categoryId' in item &&
          typeof item.categoryId === 'string',
      )
      .slice(0, 20)
  } catch {
    return []
  }
}

function defaults(transaction?: Transaction): Values {
  const base = {
    amount: transaction ? String(transaction.amountMinor / 100) : '',
    description: transaction?.description ?? '',
    merchant: transaction?.merchant ?? '',
    date: transaction
      ? localDateInputValue(toDate(transaction.transactionDate))
      : localDateInputValue(),
    notes: transaction?.notes ?? '',
    tags: transaction?.tags?.join(', ') ?? '',
    splits:
      transaction?.type === 'EXPENSE'
        ? transaction.splits?.map((split) => ({
            id: split.id,
            categoryId: split.categoryId,
            amount: String(split.amountMinor / 100),
          }))
        : undefined,
  }
  if (!transaction)
    return {
      ...base,
      type: 'EXPENSE',
      accountId: localStorage.getItem('lastUsedAccountId') ?? undefined,
    }
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
  const suggestions = loadSuggestions()
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
  const selectedAccountId = watch('accountId')
  const [splits, setSplits] = useState(() => defaults(transaction).splits ?? [])
  const activeAccounts = (accounts.data ?? []).filter((account) => !account.isArchived)
  useEffect(() => {
    const account = accounts.data?.find((item) => item.id === selectedAccountId && !item.isArchived)
    if (account) setValue('ownerUserId', account.ownerUserId)
  }, [accounts.data, selectedAccountId, setValue])
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
  const merchantSuggestions = suggestions
    .filter((item) => item.type === type)
    .map((item) => item.merchant)
  const descriptionField = register('description')
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
        ...(values.tags.trim()
          ? {
              tags: values.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 20),
            }
          : {}),
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
              ...(values.type === 'EXPENSE' && values.splits?.length
                ? {
                    splits: values.splits.map((split) => ({
                      id: split.id,
                      categoryId: split.categoryId,
                      amountMinor: parseMoneyToMinor(split.amount, household.defaultCurrency),
                    })),
                  }
                : {}),
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
      const selectedAccount = watch('accountId')
      if (selectedAccount) localStorage.setItem('lastUsedAccountId', selectedAccount)
      const selectedCategory = watch('categoryId')
      const selectedOwner = watch('ownerUserId')
      const enteredMerchant = watch('merchant') || watch('description')
      if (
        type !== 'TRANSFER' &&
        selectedAccount &&
        selectedCategory &&
        selectedOwner &&
        enteredMerchant
      ) {
        const next = [
          {
            merchant: enteredMerchant,
            type,
            accountId: selectedAccount,
            ownerUserId: selectedOwner,
            categoryId: selectedCategory,
          },
          ...suggestions.filter(
            (item) => item.merchant.toLowerCase() !== enteredMerchant.toLowerCase(),
          ),
        ].slice(0, 20)
        localStorage.setItem('manualTransactionSuggestions', JSON.stringify(next))
      }
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
          <Group grow align="start" className="responsive-fields">
            <Controller
              name="sourceAccountId"
              control={control}
              render={({ field }) => (
                <Select
                  searchable
                  allowDeselect={false}
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
                  allowDeselect={false}
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
                  allowDeselect={false}
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
                  allowDeselect={false}
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
                  allowDeselect={false}
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
            {type === 'EXPENSE' && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <TextInput readOnly variant="unstyled" value="Split categories (optional)" />
                  <Button
                    type="button"
                    size="xs"
                    variant="light"
                    onClick={() => {
                      const next = [
                        ...splits,
                        { id: crypto.randomUUID(), categoryId: '', amount: '' },
                      ]
                      setSplits(next)
                      setValue('splits', next)
                    }}
                  >
                    Add split
                  </Button>
                </Group>
                {splits.map((split, index) => (
                  <Group key={split.id} align="end" grow className="responsive-fields">
                    <Controller
                      name={`splits.${index}.categoryId`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          searchable
                          allowDeselect={false}
                          label={`Split ${index + 1} category`}
                          data={categoryOptions}
                          {...field}
                        />
                      )}
                    />
                    <Controller
                      name={`splits.${index}.amount`}
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          label="Amount"
                          decimalScale={2}
                          fixedDecimalScale
                          value={field.value}
                          onChange={(value) => field.onChange(String(value))}
                        />
                      )}
                    />
                    <Button
                      type="button"
                      color="red"
                      variant="subtle"
                      onClick={() => {
                        const next = splits.filter((_, candidateIndex) => candidateIndex !== index)
                        setSplits(next)
                        setValue('splits', next)
                      }}
                    >
                      Remove
                    </Button>
                  </Group>
                ))}
              </Stack>
            )}
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
          list={type === 'TRANSFER' ? undefined : 'merchant-suggestions'}
          error={errors.description?.message}
          {...descriptionField}
          onChange={(event) => {
            void descriptionField.onChange(event)
            const previous = suggestions.find(
              (item) =>
                item.type === type &&
                item.merchant.toLowerCase() === event.currentTarget.value.toLowerCase(),
            )
            if (previous) {
              setValue('merchant', previous.merchant)
              setValue('accountId', previous.accountId)
              setValue('ownerUserId', previous.ownerUserId)
              setValue('categoryId', previous.categoryId)
            }
          }}
        />
        <datalist id="merchant-suggestions">
          {merchantSuggestions.map((merchant) => (
            <option key={merchant} value={merchant} />
          ))}
        </datalist>
        {type !== 'TRANSFER' && <TextInput label="Merchant (optional)" {...register('merchant')} />}
        <TextInput label="Date" type="date" error={errors.date?.message} {...register('date')} />
        <Textarea label="Notes (optional)" autosize minRows={2} {...register('notes')} />
        <TextInput
          label="Tags (optional)"
          placeholder="Holiday 2026, renovation…"
          description="Separate tags with commas"
          {...register('tags')}
        />
        <Button size="md" type="submit" loading={mutation.isPending}>
          Save {type === 'EXPENSE' ? 'expense' : type === 'INCOME' ? 'income' : 'transfer'}
        </Button>
      </Stack>
    </form>
  )
}
