import { createHash, createVerify } from 'node:crypto'
import { currencyMinorDigits } from '@family-expense-tracker/shared'
import {
  ProviderError,
  type ConnectSession,
  type ConnectSessionInput,
  type OpenBankingProvider,
  type ProviderAccount,
  type ProviderConnection,
  type ProviderCustomer,
  type RefreshInput,
  type ProviderTransaction,
  type RefreshResult,
  type WebhookVerificationInput,
} from './provider.js'

const V6_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8qxSS5BmftHK/eyW+o98
NR89TyDmz1V8e6yyFdoMPddEYN4Bcidkk2whoJEc/T/AKghHQ9Nq+DuebnRYYcSJ
YT99VbR1PpIw2R9i8z+DZ79hoizy6z+rwxGANnJOr5BDF5HUKJ8uKS9yGRieojFv
Y9j+rxH6Fj6P90bO4d2igYYspKVoI3Zb3hWS0LrWN+JXAaW9qcOmQPTgO0WG0MUK
gB3NNMfN7gMIkl3chbaULiEgVciP2qZTIGb1b7IDr5+fA9oVVGaXiybdieGHIa4J
S7JNTf0JjWrIKd2DaczKULnghqNQsnoCu+S8BurEOJR5EN1BBfQBPlbSh+ru1zgZ
AQIDAQAB
-----END PUBLIC KEY-----`

type Json = Record<string, unknown>
const asObject = (value: unknown, label: string): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ProviderError('MALFORMED_RESPONSE', `Malformed ${label}.`, false)
  return value as Json
}
const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value)
    throw new ProviderError('MALFORMED_RESPONSE', `Missing ${label}.`, false)
  return value
}
const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

function decimalToMinor(value: unknown, currency: string): number | undefined {
  if (value === null || value === undefined) return undefined
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : ''
  if (!/^-?\d+(?:\.\d+)?$/.test(text))
    throw new ProviderError('MALFORMED_AMOUNT', 'Provider returned an invalid amount.', false)
  const digits = currencyMinorDigits(currency)
  const negative = text.startsWith('-')
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.')
  if (fraction.slice(digits).replace(/0/g, ''))
    throw new ProviderError('MALFORMED_AMOUNT', 'Provider amount has unsupported precision.', false)
  const minor =
    Number(`${whole}${fraction.slice(0, digits).padEnd(digits, '0')}`) * (negative ? -1 : 1)
  if (!Number.isSafeInteger(minor))
    throw new ProviderError('MALFORMED_AMOUNT', 'Provider amount is outside the safe range.', false)
  return minor
}

function providerAccountType(nature: unknown): ProviderAccount['type'] {
  if (nature === 'checking') return 'CHECKING'
  if (nature === 'savings') return 'SAVINGS'
  if (nature === 'credit' || nature === 'credit_card') return 'CREDIT_CARD'
  if (nature === 'debit_card') return 'DEBIT_CARD'
  if (nature === 'card') return 'CARD'
  return 'OTHER'
}

export class SaltEdgeProvider implements OpenBankingProvider {
  readonly name = 'SALT_EDGE' as const
  constructor(
    private readonly appId: string,
    private readonly secret: string,
    private readonly baseUrl = 'https://www.saltedge.com/api/v6',
  ) {
    if (!appId || !secret) throw new Error('Salt Edge credentials are not configured.')
  }

  private async request(path: string, init: RequestInit = {}): Promise<Json> {
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
          ...init,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'App-id': this.appId,
            Secret: this.secret,
            ...init.headers,
          },
        })
        if (response.ok) return asObject(await response.json(), 'Salt Edge response')
        const retryable = response.status === 429 || response.status >= 500
        const retryAfterSeconds = Number(response.headers.get('retry-after'))
        const body = await response.text()
        let code = `HTTP_${response.status}`
        try {
          code =
            optionalString(
              asObject(asObject(JSON.parse(body), 'error response').error, 'error').class,
            ) ?? code
        } catch {
          /* response body intentionally discarded */
        }
        const retryAfterMs = Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds * 1000
          : undefined
        if (!retryable || attempt === 2)
          throw new ProviderError(
            code,
            'Open Banking provider request failed.',
            retryable,
            retryAfterMs,
          )
        if (retryAfterMs && retryAfterMs > 30_000)
          throw new ProviderError(
            code,
            'Open Banking provider rate limit is active.',
            true,
            retryAfterMs,
          )
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs ?? 250 * 2 ** attempt))
      } catch (error) {
        if (error instanceof ProviderError) throw error
        lastError = error
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
      }
    }
    throw new ProviderError(
      'NETWORK_ERROR',
      lastError instanceof Error ? lastError.message : 'Provider network error',
      true,
    )
  }

  private async list(path: string): Promise<unknown[]> {
    const items: unknown[] = []
    const visited = new Set<string>()
    let nextPath: string | undefined = path
    while (nextPath) {
      if (visited.has(nextPath) || visited.size >= 1_000)
        throw new ProviderError(
          'MALFORMED_PAGINATION',
          'Provider pagination did not finish.',
          false,
        )
      visited.add(nextPath)
      const response = await this.request(nextPath)
      if (!Array.isArray(response.data))
        throw new ProviderError('MALFORMED_RESPONSE', 'Malformed list response.', false)
      items.push(...(response.data as unknown[]))
      const meta = response.meta === undefined ? {} : asObject(response.meta, 'pagination')
      const nextPage = optionalString(meta.next_page)
      if (!nextPage) {
        nextPath = undefined
        continue
      }
      const base = new URL(this.baseUrl)
      const next = new URL(nextPage, base.origin)
      if (next.origin !== base.origin)
        throw new ProviderError(
          'MALFORMED_PAGINATION',
          'Provider pagination changed origin.',
          false,
        )
      const basePath = base.pathname.replace(/\/$/, '')
      const relativePath = next.pathname.startsWith(basePath)
        ? next.pathname.slice(basePath.length)
        : next.pathname
      nextPath = `${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}${next.search}`
    }
    return items
  }

  async createCustomer(identifier: string): Promise<ProviderCustomer> {
    const data = asObject(
      (
        await this.request('/customers', {
          method: 'POST',
          body: JSON.stringify({ data: { identifier } }),
        })
      ).data,
      'customer',
    )
    return { id: requiredString(data.customer_id, 'customer_id') }
  }

  private sessionPayload(
    input: Omit<ConnectSessionInput, 'institutionId'>,
    institutionId?: string,
  ): Json {
    return {
      customer_id: input.customerId,
      consent: { scopes: ['accounts', 'transactions'], period_days: 90 },
      attempt: {
        fetch_scopes: ['accounts', 'balance', 'transactions'],
        fetch_from_date: new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10),
        unduplicate_transactions: 'mark_as_pending',
      },
      widget: {
        return_to: input.returnTo,
        skip_provider_selection: Boolean(institutionId),
        skip_stages_screen: false,
      },
      ...(institutionId ? { provider: { code: institutionId } } : {}),
      custom_fields: input.customFields,
      automatic_refresh: true,
    }
  }

  private parseSession(response: Json): ConnectSession {
    const data = asObject(response.data, 'connect session')
    const expiresAt = optionalString(data.expires_at)
    return {
      url: requiredString(data.connect_url, 'connect_url'),
      ...(expiresAt ? { expiresAt } : {}),
    }
  }

  async createConnectSession(input: ConnectSessionInput): Promise<ConnectSession> {
    return this.parseSession(
      await this.request('/connections/connect', {
        method: 'POST',
        body: JSON.stringify({ data: this.sessionPayload(input, input.institutionId) }),
      }),
    )
  }
  async createReconnectSession(
    connectionId: string,
    input: Omit<ConnectSessionInput, 'institutionId'>,
  ): Promise<ConnectSession> {
    return this.parseSession(
      await this.request(`/connections/${encodeURIComponent(connectionId)}/reconnect`, {
        method: 'POST',
        body: JSON.stringify({ data: this.sessionPayload(input) }),
      }),
    )
  }
  async refreshConnection(connectionId: string, input?: RefreshInput): Promise<RefreshResult> {
    const data = asObject(
      (
        await this.request(`/connections/${encodeURIComponent(connectionId)}/background_refresh`, {
          method: 'POST',
          body: JSON.stringify({
            data: {
              attempt: {
                fetch_scopes: ['accounts', 'balance', 'transactions'],
                ...(input ? { custom_fields: input.customFields } : {}),
              },
              automatic_refresh: true,
            },
          }),
        })
      ).data,
      'refresh',
    )
    const nextRefreshPossibleAt = optionalString(data.next_refresh_possible_at)
    const authorizationUrl = optionalString(data.connect_url)
    return {
      ...(nextRefreshPossibleAt ? { nextRefreshPossibleAt } : {}),
      ...(authorizationUrl ? { authorizationUrl } : {}),
    }
  }
  async getConnection(connectionId: string): Promise<ProviderConnection> {
    const data = asObject(
      (await this.request(`/connections/${encodeURIComponent(connectionId)}`)).data,
      'connection',
    )
    const rawStatus = requiredString(data.status, 'status')
    const rawConsent = optionalString(data.consent_status)?.toUpperCase()
    const nextRefreshPossibleAt = optionalString(data.next_refresh_possible_at)
    return {
      id: requiredString(data.id, 'connection id'),
      customerId: requiredString(data.customer_id, 'customer id'),
      institutionId: requiredString(data.provider_code, 'provider code'),
      institutionName: requiredString(data.provider_name, 'provider name'),
      status:
        rawStatus === 'active' ? 'ACTIVE' : rawStatus === 'disabled' ? 'DISABLED' : 'INACTIVE',
      consentStatus:
        rawConsent === 'ACTIVE' || rawConsent === 'EXPIRED' || rawConsent === 'REVOKED'
          ? rawConsent
          : 'UNKNOWN',
      ...(nextRefreshPossibleAt ? { nextRefreshPossibleAt } : {}),
    }
  }
  async getAccounts(connectionId: string): Promise<ProviderAccount[]> {
    const response = await this.list(
      `/accounts?connection_id=${encodeURIComponent(connectionId)}&per_page=250`,
    )
    return response.map((item) => {
      const data = asObject(item, 'account')
      const currency = requiredString(data.currency_code, 'currency_code').toUpperCase()
      const extra =
        data.extra && typeof data.extra === 'object' && !Array.isArray(data.extra)
          ? (data.extra as Json)
          : {}
      const type = providerAccountType(data.nature)
      const rawLast4 =
        optionalString(extra.card_last_digits) ?? optionalString(extra.account_number)
      const digits = rawLast4?.replace(/\D/g, '') ?? ''
      const last4 = digits.length >= 4 ? digits.slice(-4) : undefined
      const rawBalance = decimalToMinor(data.balance, currency)
      const availableMinor = decimalToMinor(extra.available_amount, currency)
      const creditLimitMinor = decimalToMinor(extra.credit_limit, currency)
      return {
        id: requiredString(data.id, 'account id'),
        name: optionalString(extra.account_name) ?? requiredString(data.name, 'account name'),
        type,
        currency,
        ...(last4 ? { last4, maskedIdentifier: `•••• ${last4}` } : {}),
        balance: {
          ...(type === 'CREDIT_CARD' && rawBalance !== undefined
            ? { outstandingMinor: Math.abs(rawBalance) }
            : rawBalance !== undefined
              ? { currentMinor: rawBalance }
              : {}),
          ...(availableMinor !== undefined ? { availableMinor } : {}),
          ...(creditLimitMinor !== undefined
            ? { creditLimitMinor: Math.abs(creditLimitMinor) }
            : {}),
          currency,
          reportedAt: optionalString(data.updated_at) ?? new Date().toISOString(),
        },
      }
    })
  }
  async getTransactions(connectionId: string, _fromDate: string): Promise<ProviderTransaction[]> {
    const query = `connection_id=${encodeURIComponent(connectionId)}&per_page=250`
    const [posted, pending] = await Promise.all([
      this.list(`/transactions?${query}&pending=false`),
      this.list(`/transactions?${query}&pending=true`),
    ])
    return [...posted, ...pending].map((item) => {
      const data = asObject(item, 'transaction')
      const extra =
        data.extra && typeof data.extra === 'object' && !Array.isArray(data.extra)
          ? (data.extra as Json)
          : {}
      const currency = requiredString(data.currency_code, 'currency_code').toUpperCase()
      const signed = decimalToMinor(data.amount, currency)
      if (signed === undefined || signed === 0)
        throw new ProviderError('MALFORMED_AMOUNT', 'Zero or missing transaction amount.', false)
      const rawStatus = optionalString(data.status)?.toUpperCase()
      const status: ProviderTransaction['status'] =
        rawStatus === 'PENDING'
          ? 'PENDING'
          : rawStatus === 'REVERSED'
            ? 'REVERSED'
            : rawStatus === 'CANCELLED'
              ? 'CANCELLED'
              : 'BOOKED'
      const merchantName =
        optionalString(data.merchant_name) ??
        optionalString(extra.payee_information) ??
        optionalString(extra.payer_information)
      const transactionDate = optionalString(data.made_on)
      const bookingDate = optionalString(extra.posting_date)
      const valueDate = optionalString(data.value_date)
      const providerReference =
        optionalString(extra.end_to_end_id) ??
        optionalString(extra.id) ??
        optionalString(extra.constant_code) ??
        optionalString(extra.record_number)
      return {
        id: requiredString(data.id, 'transaction id'),
        accountId: requiredString(data.account_id, 'account id'),
        amountMinor: Math.abs(signed),
        direction: signed < 0 ? 'DEBIT' : 'CREDIT',
        currency,
        description: optionalString(data.description) ?? merchantName ?? 'Bank transaction',
        ...(merchantName ? { merchantName } : {}),
        ...(transactionDate ? { transactionDate } : {}),
        ...(bookingDate ? { bookingDate } : {}),
        ...(valueDate ? { valueDate } : {}),
        ...(providerReference ? { providerReference } : {}),
        status,
        payloadHash: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      }
    })
  }
  async disconnect(connectionId: string): Promise<void> {
    await this.request(`/connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' })
  }
  async verifyWebhook(input: WebhookVerificationInput): Promise<boolean> {
    if (input.signatureKeyVersion !== '6.0') return false
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${input.callbackUrl}|`)
    verifier.update(input.rawBody)
    verifier.end()
    try {
      return verifier.verify(V6_PUBLIC_KEY, input.signature, 'base64')
    } catch {
      return false
    }
  }
}
