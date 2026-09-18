import { createTheme, rem } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'teal',
  primaryShade: 8,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: { fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontWeight: '650' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  colors: {
    teal: [
      '#eef9f7',
      '#dcefeb',
      '#b7ddd6',
      '#8ec9bf',
      '#6bb7aa',
      '#53aa9a',
      '#449f8e',
      '#338c7d',
      '#247064',
      '#145f52',
    ],
  },
  shadows: { card: `0 ${rem(8)} ${rem(30)} rgba(24, 48, 43, 0.07)` },
})
