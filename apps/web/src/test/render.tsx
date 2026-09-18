import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { theme } from '../theme/theme'

export function renderApp(ui: ReactElement, options?: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MantineProvider theme={theme}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MantineProvider>,
    options,
  )
}
