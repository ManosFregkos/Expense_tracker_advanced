import { afterEach, describe, expect, it, vi } from 'vitest'
import { SaltEdgeProvider } from './saltedge-provider.js'

describe('SaltEdgeProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('puts V6 callback correlation and return URL fields inside the attempt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            connect_url: 'https://www.saltedge.com/connect?token=test',
            expires_at: '2026-09-19T12:05:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const provider = new SaltEdgeProvider('test-app-id', 'test-secret')

    await provider.createConnectSession({
      customerId: 'customer-1',
      institutionId: 'fakebank_oauth_with_pending_and_available_balance_xf',
      returnTo: 'https://expense-tracker-v2-9520e.web.app/bank-connections',
      customFields: { appConnectionId: 'connection-1', householdId: 'household-1' },
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const request = fetchMock.mock.calls[0]
    expect(request?.[0]).toBe('https://www.saltedge.com/api/v6/connections/connect')
    const requestBody = request?.[1]?.body
    expect(typeof requestBody).toBe('string')
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body.')
    expect(JSON.parse(requestBody)).toEqual({
      data: {
        customer_id: 'customer-1',
        consent: { scopes: ['accounts', 'transactions'], period_days: 90 },
        attempt: {
          fetch_scopes: ['accounts', 'balance', 'transactions'],
          fetch_from_date: '2024-09-19',
          unduplication_strategy: 'mark_as_pending',
          return_to: 'https://expense-tracker-v2-9520e.web.app/bank-connections',
          custom_fields: { appConnectionId: 'connection-1', householdId: 'household-1' },
        },
        widget: { skip_provider_selection: true, skip_stages_screen: false },
        provider: { code: 'fakebank_oauth_with_pending_and_available_balance_xf' },
        automatic_refresh: true,
      },
    })
  })
})
