import { zodResolver } from '@hookform/resolvers/zod'
import { Button, NumberInput, Select, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useEffect } from 'react'
import { z } from 'zod'
import {
  ACCOUNT_TYPES,
  parseMoneyToMinor,
  type FinancialAccount,
} from '@family-expense-tracker/shared'
import { useHousehold } from '../households/HouseholdProvider'
import { useAuth } from '../auth/AuthProvider'
import { useMembers } from '../../hooks/useHouseholdData'
import { api } from '../../lib/callables'
import { accountKeys } from '../../lib/query-keys'
import { friendlyError } from '../../lib/errors'

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  ownerUserId: z.string().min(1),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(120).optional(),
  openingBalance: z.string().min(1),
})
type Values = z.infer<typeof schema>

export function AccountForm({ account, onSaved }: { account?: FinancialAccount; onSaved(): void }) {
  const { household } = useHousehold()
  const { user } = useAuth()
  const members = useMembers()
  const queryClient = useQueryClient()
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? '',
      ownerUserId: account?.ownerUserId ?? user?.uid ?? members.data?.[0]?.userId ?? '',
      type: account?.type ?? 'BANK',
      institution: account?.institution ?? '',
      openingBalance: account ? String(account.openingBalanceMinor / 100) : '0',
    },
  })
  useEffect(() => {
    const firstMember = members.data?.[0]
    if (!account && !getValues('ownerUserId'))
      setValue('ownerUserId', user?.uid ?? firstMember?.userId ?? '')
  }, [account, getValues, members.data, setValue, user?.uid])
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (!household) throw new Error('No household selected')
      if (account)
        return api.updateAccount({
          householdId: household.id,
          accountId: account.id,
          name: values.name,
          ...(values.institution ? { institution: values.institution } : {}),
        })
      return api.createAccount({
        householdId: household.id,
        ownerUserId: values.ownerUserId,
        name: values.name,
        type: values.type,
        ...(values.institution ? { institution: values.institution } : {}),
        currency: household.defaultCurrency,
        openingBalanceMinor: parseMoneyToMinor(values.openingBalance, household.defaultCurrency),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all(household!.id) })
      notifications.show({
        color: 'teal',
        message: account ? 'Account updated.' : 'Account created.',
      })
      onSaved()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        title: 'Could not save account',
        message: friendlyError(error),
      }),
  })
  return (
    <form onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}>
      <Stack>
        <TextInput
          label="Account name"
          placeholder="e.g. Eurobank"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />
        <Controller
          name="ownerUserId"
          control={control}
          render={({ field }) => (
            <Select
              label="Owner"
              data={(members.data ?? []).map((member) => ({
                value: member.userId,
                label: member.displayName,
              }))}
              disabled={Boolean(account)}
              error={errors.ownerUserId?.message}
              {...field}
            />
          )}
        />
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              label="Account type"
              data={ACCOUNT_TYPES.map((type) => ({
                value: type,
                label: type.replaceAll('_', ' '),
              }))}
              disabled={Boolean(account)}
              {...field}
            />
          )}
        />
        <TextInput
          label="Institution (optional)"
          placeholder="Bank or provider"
          {...register('institution')}
        />
        {!account && (
          <Controller
            name="openingBalance"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Opening balance"
                decimalScale={2}
                fixedDecimalScale
                prefix={`${household?.defaultCurrency ?? 'EUR'} `}
                value={field.value}
                onChange={(value) => field.onChange(String(value))}
              />
            )}
          />
        )}
        <Button type="submit" loading={mutation.isPending}>
          {account ? 'Save changes' : 'Create account'}
        </Button>
      </Stack>
    </form>
  )
}
