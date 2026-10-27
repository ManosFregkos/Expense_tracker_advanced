import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { transactionKeys } from '../../lib/query-keys'
import { visibleTransactionIds } from './visible-transactions'

const client = new QueryClient()
const unsubscribes: (() => void)[] = []
function show(filters: object, ids: string[]) {
  const queryKey = transactionKeys.list('h1', filters)
  client.setQueryData(queryKey, { transactions: ids.map((id) => ({ id })) })
  const observer = new QueryObserver(client, { queryKey, enabled: false })
  unsubscribes.push(observer.subscribe(() => undefined))
}
afterEach(() => {
  unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe())
  client.clear()
  window.history.replaceState(null, '', '/')
})
describe('visible Jarvis transaction context', () => {
  it('uses the observed page order and ignores cached pages and other households', () => {
    window.history.replaceState(null, '', '/transactions?period=THIS_MONTH')
    client.setQueryData(transactionKeys.list('h1', { page: 0 }), {
      transactions: [{ id: 'cached-older-page' }],
    })
    show({ page: 1 }, ['second-date', 'first-date'])
    expect(visibleTransactionIds(client, 'h1')).toEqual(['second-date', 'first-date'])
    expect(visibleTransactionIds(client, 'other-household')).toBeUndefined()
    window.history.replaceState(null, '', '/dashboard')
    expect(visibleTransactionIds(client, 'h1')).toBeUndefined()
  })
  it('preserves an empty visible list instead of silently selecting a hidden transaction', () => {
    window.history.replaceState(null, '', '/transactions')
    show({ page: 0 }, [])
    expect(visibleTransactionIds(client, 'h1')).toEqual([])
  })
  it('omits ambiguous context if multiple list pages are observed', () => {
    window.history.replaceState(null, '', '/transactions')
    show({ page: 0 }, ['a'])
    show({ page: 1 }, ['b'])
    expect(visibleTransactionIds(client, 'h1')).toBeUndefined()
  })
})
