import type { OpenBankingProvider } from './provider.js'
import { MockBankProvider } from './mock-provider.js'
import { SaltEdgeProvider } from './saltedge-provider.js'
import { saltEdgeAppId, saltEdgeSecret } from './secrets.js'

let cached: OpenBankingProvider | undefined

export function getOpenBankingProvider(): OpenBankingProvider {
  if (cached) return cached
  const selected =
    process.env.OPEN_BANKING_PROVIDER ?? (process.env.FUNCTIONS_EMULATOR ? 'mock' : 'saltedge')
  cached =
    selected === 'mock'
      ? new MockBankProvider()
      : new SaltEdgeProvider(
          process.env.SALTEDGE_APP_ID ?? saltEdgeAppId.value(),
          process.env.SALTEDGE_SECRET ?? saltEdgeSecret.value(),
          process.env.SALTEDGE_BASE_URL ?? 'https://www.saltedge.com/api/v6',
          process.env.SALTEDGE_PRIVATE_KEY,
        )
  return cached
}
