import { createVerify, generateKeyPairSync } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SaltEdgeProvider } from './saltedge-provider.js'

const signingKeys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const signingPrivateKey = signingKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

function expectValidSignature(
  request: Parameters<typeof fetch>,
  method: string,
  body: string,
): void {
  const resource = request[0]
  const url =
    typeof resource === 'string'
      ? resource
      : resource instanceof URL
        ? resource.toString()
        : resource.url
  const headers = new Headers(request[1]?.headers)
  const expiresAt = headers.get('Expires-at')
  const signature = headers.get('Signature')
  expect(expiresAt).toBe(String(Math.floor(Date.now() / 1_000) + 60))
  expect(signature).toBeTruthy()
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${expiresAt}|${method}|${url}|${body}`)
  verifier.end()
  expect(verifier.verify(signingKeys.publicKey, signature ?? '', 'base64')).toBe(true)
}

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

  it('signs a POST using its exact URL and raw JSON body', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { customer_id: 'customer-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const provider = new SaltEdgeProvider(
      'test-app-id',
      'test-secret',
      'https://www.saltedge.com/api/v6',
      signingPrivateKey,
    )

    await provider.createCustomer('firebase:user-1')

    const request = fetchMock.mock.calls[0]
    expect(request).toBeDefined()
    const body = request?.[1]?.body
    expect(typeof body).toBe('string')
    if (!request || typeof body !== 'string') throw new Error('Expected a signed JSON request.')
    expectValidSignature(request, 'POST', body)
  })

  it('signs a GET using its full query URL and an empty body', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { next_page: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const provider = new SaltEdgeProvider(
      'test-app-id',
      'test-secret',
      'https://www.saltedge.com/api/v6',
      signingPrivateKey,
    )

    await provider.getAccounts('connection/with spaces')

    const request = fetchMock.mock.calls[0]
    expect(request?.[0]).toBe(
      'https://www.saltedge.com/api/v6/accounts?connection_id=connection%2Fwith%20spaces&per_page=250',
    )
    if (!request) throw new Error('Expected a signed request.')
    expectValidSignature(request, 'GET', '')
  })
})
