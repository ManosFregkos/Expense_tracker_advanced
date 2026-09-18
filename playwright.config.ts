import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry' },
  webServer: {
    command:
      'VITE_USE_FIREBASE_EMULATORS=true VITE_AUTH_EMULATOR_PORT=9199 VITE_FIRESTORE_EMULATOR_PORT=8280 VITE_FUNCTIONS_EMULATOR_PORT=5101 npm run dev --workspace=@family-expense-tracker/web -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
