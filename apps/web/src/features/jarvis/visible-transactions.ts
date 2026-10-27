import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { transactionKeys } from '../../lib/query-keys'

export function visibleTransactionIds(
  client: QueryClient,
  householdId: string,
): string[] | undefined {
  if (window.location.pathname !== '/transactions') return undefined
  const active = client
    .getQueryCache()
    .findAll({ queryKey: transactionKeys.all(householdId) })
    .filter((query) => query.getObserversCount() > 0 && query.queryKey[2] === 'list')
  if (active.length !== 1 || active[0]!.state.status !== 'success') return undefined
  const page = z
    .object({ transactions: z.array(z.object({ id: z.string() })).max(100) })
    .safeParse(active[0]!.state.data)
  return page.success ? page.data.transactions.map(({ id }) => id) : undefined
}
