import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('register, onboard, and complete the core household finance workflow', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000)
  const email = `family-${Date.now()}@example.test`
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/register')
  await page.screenshot({ path: testInfo.outputPath('mobile-register.png') })
  await page.getByLabel('Your name').fill('Emmanouil Test')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('DemoPass123!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()

  await execFileAsync(process.execPath, [resolve('tests/e2e/helpers/verify-user.mjs'), email], {
    env: { ...process.env, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199' },
  })

  await page.getByRole('button', { name: 'I have verified my email' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your household' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-onboarding.png') })
  await page.getByLabel('Household name').fill('E2E Family')
  await page.getByRole('button', { name: 'Create household' }).click()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('button', { name: 'Go to accounts' })).toBeVisible()
  await page.getByRole('button', { name: 'Go to accounts' }).click()
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 720 })

  for (const route of ['/review', '/bank-connections', '/transactions/review']) {
    await page.goto(route)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'Review transactions' })).toHaveCount(0)
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: 'Bank connections' })).toHaveCount(0)
  await page.goto('/accounts')

  await page.getByRole('button', { name: 'Add account' }).first().click()
  await page.getByLabel('Account name').fill('Eurobank')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Eurobank', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Add account' }).first().click()
  await page.getByLabel('Account name').fill('Cash')
  await page.getByRole('textbox', { name: 'Account type' }).click()
  await page.getByRole('option', { name: 'CASH' }).click()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Cash', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Add transaction' }).first().click()
  await expect(page.getByRole('radio')).toHaveCount(2)
  await page.getByLabel('Amount').fill('72.43')
  await page.getByRole('textbox', { name: 'Account', exact: true }).click()
  await page.getByRole('option', { name: /Eurobank/ }).click()
  await page.getByRole('textbox', { name: 'Category' }).click()
  await page.getByRole('option', { name: /Supermarket/ }).click()
  await page.getByLabel('Description / merchant').fill('Lidl')
  await page.getByRole('button', { name: 'Save expense' }).click()
  await expect(page.getByText('Expense saved')).toBeVisible()

  await page.getByRole('button', { name: 'Add transaction' }).first().click()
  await page.getByText('Income', { exact: true }).click()
  await page.getByLabel('Amount').fill('3000')
  await page.getByRole('textbox', { name: 'Account', exact: true }).click()
  await page.getByRole('option', { name: /Eurobank/ }).click()
  await page.getByRole('textbox', { name: 'Category' }).click()
  await page.getByRole('option', { name: 'Salary' }).click()
  await page.getByLabel('Description / merchant').fill('September salary')
  await page.getByRole('button', { name: 'Save income' }).click()
  await expect(page.getByText('Income saved')).toBeVisible()

  await page.goto('/dashboard')
  await expect(page.getByText(/€3,000\.00/).first()).toBeVisible()
  await expect(page.getByText(/€72\.43/).first()).toBeVisible()

  await page.goto('/members')
  await page.getByRole('button', { name: 'Invite member' }).click()
  await page.getByLabel('Email').fill('spouse@example.test')
  await page.getByRole('button', { name: 'Create invitation' }).click()
  await expect(page.getByText('spouse@example.test')).toBeVisible()

  await page.goto('/transactions?period=THIS_YEAR')
  await expect(page.getByLabel('Income total')).toContainText('€3,000.00')
  await expect(page.getByLabel('Expenses total')).toContainText('€72.43')
  await expect(page.getByLabel('Net total')).toContainText('€2,927.57')
  await expect(page.getByText('Lidl').first()).toBeVisible()
  await page.getByRole('table').getByText('Lidl').click()
  await page.getByLabel('Description / merchant').fill('Lidl weekly')
  await page.getByRole('button', { name: 'Save expense' }).click()
  await expect(page.getByText('Lidl weekly').first()).toBeVisible()
  await page.getByRole('table').getByText('Lidl weekly').click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete transaction' }).click()
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
  await expect(page.getByText('Lidl weekly')).toHaveCount(0)
  await expect(page.getByLabel('Expenses total')).toContainText('€0.00')
  await execFileAsync(
    process.execPath,
    [resolve('tests/e2e/helpers/create-pagination-transactions.mjs'), email],
    {
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8280',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
      },
    },
  )
  await page.reload()
  await expect(page.getByText(/27 matching transactions/)).toBeVisible()
  await expect(page.getByLabel('Expenses total')).toContainText('€26.00')
  await expect(page.getByLabel('Net total')).toContainText('€2,974.00')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Page 2')).toBeVisible()
  await expect(page.getByLabel('Expenses total')).toContainText('€26.00')
  await expect(page.getByLabel('Income total')).toContainText('€3,000.00')
  await page.getByLabel('Search', { exact: true }).fill('pagination')
  await expect(page.getByText(/26 matching transactions/)).toBeVisible()
  await expect(page.getByLabel('Income total')).toContainText('€0.00')
  await expect(page.getByLabel('Net total')).toContainText('-€26.00')

  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(4)
  await expect(page.getByRole('radio').nth(0)).toHaveAccessibleName('All')
  await expect(page.getByRole('radio').nth(0)).toBeChecked()
  await expect(page.getByRole('radio').nth(1)).toHaveAccessibleName('Today')
  await expect(page.getByRole('radio').nth(2)).toHaveAccessibleName('Upcoming')
  await expect(page.getByRole('radio').nth(3)).toHaveAccessibleName('Completed')
  await page.getByLabel('Quick task title').fill('Buy groceries')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Buy groceries' })).toBeVisible()
  await page.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect(page.getByText('DONE')).toBeVisible()
  await page.getByRole('button', { name: 'Reopen' }).click()
  await expect(page.getByText('TODO')).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'IN PROGRESS' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('In progress', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel task' }).click()
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible()
  await page.getByRole('button', { name: 'Reopen' }).click()
  await expect(page.getByText('TODO')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Add task' }).first().click()
  const taskDialog = page.getByRole('dialog')
  await taskDialog.getByRole('textbox', { name: /Title/ }).fill('Weekly house cleaning')
  await taskDialog.getByRole('textbox', { name: 'Priority' }).click()
  await page.getByRole('option', { name: 'High' }).click()
  await taskDialog.getByRole('button', { name: 'Today' }).click()
  await taskDialog.getByLabel('Repeat this task').check()
  await taskDialog.getByRole('button', { name: 'Create task' }).click()
  await expect(page.getByRole('heading', { name: 'Weekly house cleaning' })).toBeVisible()
  await page.getByRole('button', { name: 'Complete', exact: true }).dblclick()
  await expect(page.getByText('DONE')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/tasks?view=all')
  await expect(page.getByText('Weekly house cleaning')).toHaveCount(1)

  await page.getByRole('button', { name: 'Select tasks' }).click()
  await page.getByLabel('Select all on this page').check()
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Assign selected' }).click()
  await page.getByRole('textbox', { name: 'Assign to' }).click()
  await page.getByRole('option', { name: 'Emmanouil Test' }).click()
  await page.getByRole('button', { name: 'Apply changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('0 selected', { exact: true })).toBeVisible()
  await expect(page.locator('.task-row').filter({ hasText: 'Buy groceries' })).toContainText(
    'Emmanouil Test',
  )
  await expect(
    page.locator('.task-row').filter({ hasText: 'Weekly house cleaning' }),
  ).toContainText('Emmanouil Test')
  await page.getByLabel('Select all on this page').check()
  await page.getByRole('button', { name: 'Reschedule selected' }).click()
  await page.getByLabel('New due date').fill('2027-01-15')
  await page.getByLabel('Set the same time for all selected tasks').check()
  await page.getByLabel('New due time').fill('18:30')
  await page.getByRole('button', { name: 'Apply changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('0 selected', { exact: true })).toBeVisible()
  await expect(page.locator('.task-row').filter({ hasText: 'Buy groceries' })).toContainText(
    '2027-01-15 at 18:30',
  )
  await expect(
    page.locator('.task-row').filter({ hasText: 'Weekly house cleaning' }),
  ).toContainText('2027-01-15 at 18:30')
  await page.getByLabel('Select all on this page').check()
  await page.screenshot({ path: testInfo.outputPath('desktop-task-bulk-actions.png') })
  await page.getByRole('button', { name: 'Complete selected' }).click()
  await expect(page.getByText('Buy groceries', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Weekly house cleaning', { exact: true })).toHaveCount(1)
  await expect(page.locator('.task-row')).toContainText('2027-01-22 at 18:30')
  await page.getByRole('button', { name: 'Cancel selection' }).click()

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of [
      '/dashboard',
      '/transactions?period=THIS_YEAR',
      '/accounts',
      '/analytics',
      '/categories',
      '/members',
      '/tasks?view=all',
      '/settings',
      '/profile',
    ]) {
      await page.goto(route)
      await expect(page.locator('.page')).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
        .toBeLessThanOrEqual(1)
      if (
        ['/dashboard', '/transactions?period=THIS_YEAR', '/tasks?view=all', '/settings'].includes(
          route,
        )
      ) {
        const name = route.split('?')[0]!.slice(1)
        await page.screenshot({ path: testInfo.outputPath(`mobile-${width}-${name}.png`) })
      }
    }
    await page.goto('/dashboard')
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Tasks' })
      .click()
    await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /More filters/ }).click()
    await expect(page.getByRole('textbox', { name: 'Priority' })).toBeVisible()
    await page.getByRole('button', { name: 'Add task' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Select tasks' }).click()
    await page.getByLabel('Select all on this page').check()
    await expect(page.getByRole('button', { name: 'Reschedule selected' })).toBeEnabled()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`mobile-${width}-task-bulk-actions.png`) })
    await page.getByRole('button', { name: 'Cancel selection' }).click()
    await page.goto('/transactions?period=THIS_YEAR')
    await page.getByRole('button', { name: /More filters/ }).click()
    await expect(page.getByRole('textbox', { name: 'Type' })).toBeVisible()
  }

  // Provider calls are mocked; exercise the real assistant UI without spending API quota.
  let confirmations = 0
  let transcriptions = 0
  const jarvisMessages: string[] = []
  await page.route('**/europe-west1/jarvisTranscribe', async (route) => {
    transcriptions += 1
    const body = route.request().postDataJSON() as {
      data: { mimeType: string; audioBase64: string }
    }
    expect(body.data.mimeType).toBe('audio/webm')
    expect(body.data.audioBase64.length).toBeGreaterThan(0)
    await route.fulfill({ json: { result: { text: 'Add 30 euros supermarket' } } })
  })
  await page.route('**/europe-west1/jarvisChat', async (route) => {
    const body = route.request().postDataJSON() as { data: { requestId: string; message: string } }
    jarvisMessages.push(body.data.message)
    const deletion = body.data.message.toLowerCase().includes('delete')
    await route.fulfill({
      json: {
        result: deletion
          ? {
              reply: 'Confirm deletion: Supermarket · €30.00 · Cash · 2026-10-27',
              action: {
                requestId: body.data.requestId,
                kind: 'DELETE_TRANSACTION',
                summary: 'Supermarket · €30.00 · Cash · 2026-10-27',
                expiresAt: new Date(Date.now() + 600_000).toISOString(),
              },
            }
          : { reply: 'Air scatters blue sunlight more than red sunlight.', action: null },
      },
    })
  })
  await page.route('**/europe-west1/jarvisAction', async (route) => {
    confirmations += 1
    await route.fulfill({
      json: {
        result: {
          status: 'COMPLETED',
          message: 'Deleted: Supermarket · €30.00',
          entityId: 'mock-preview',
        },
      },
    })
  })
  // Exercise the browser recognition lifecycle, including an immediate start event.
  await page.evaluate(() => {
    class SpeechProbe {
      lang = ''
      continuous = false
      interimResults = false
      phraseConfigured = false
      get phrases(): object[] {
        return []
      }
      set phrases(_value: object[]) {
        this.phraseConfigured = true
      }
      onstart: (() => void) | null = null
      onend: (() => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onresult:
        | ((event: {
            resultIndex: number
            results: { isFinal: boolean; 0: { transcript: string } }[]
          }) => void)
        | null = null
      index = 0
      receive = (event: Event) => {
        const { text, final } = (event as CustomEvent<{ text: string; final: boolean }>).detail
        this.onresult?.({
          resultIndex: this.index,
          results: Array.from({ length: this.index + 1 }, (_, index) => ({
            isFinal: final,
            0: { transcript: index === this.index ? text : '' },
          })),
        })
        if (final) this.index += 1
      }
      constructor() {
        window.addEventListener('jarvis-test-transcript', this.receive)
      }
      start() {
        // Reproduce a provider that rejects even an emptied phrases configuration.
        if (this.phraseConfigured) {
          this.onerror?.({ error: 'phrases-not-supported' })
          this.onend?.()
          return
        }
        this.index = 0
        this.onstart?.()
      }
      stop() {
        this.onend?.()
      }
      abort() {
        window.removeEventListener('jarvis-test-transcript', this.receive)
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SpeechProbe })
    class RecordingProbe {
      static isTypeSupported = (type: string) => type.startsWith('audio/webm')
      state = 'inactive'
      mimeType = 'audio/webm;codecs=opus'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['simulated speech'], { type: this.mimeType }) })
        this.onstop?.()
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: RecordingProbe })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    })
    Object.defineProperty(window, 'SpeechRecognitionPhrase', {
      configurable: true,
      value: class {},
    })
  })
  const say = async (text: string, final = true) => {
    await page.evaluate(
      ({ text, final }) =>
        window.dispatchEvent(
          new CustomEvent('jarvis-test-transcript', { detail: { text, final } }),
        ),
      { text, final },
    )
  }
  await page.setViewportSize({ width: 320, height: 719 })
  await page.getByLabel('Open Jarvis').click()
  await page.getByText('Voice settings', { exact: true }).click()
  await page.getByLabel('Read replies aloud').uncheck()
  await page.getByText('Voice settings', { exact: true }).click()
  await expect(page.getByLabel('Message Jarvis')).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport()
  await page.getByRole('button', { name: 'Enable voice', exact: true }).click()
  await say("hey Debbie's")
  await expect(page.getByText(/If you meant Jarvis/)).toBeVisible()
  expect(jarvisMessages).toHaveLength(0)
  await say('Hey Jarvis', false)
  await expect(page.getByText('Hearing: Hey Jarvis', { exact: true })).toBeVisible()
  expect(jarvisMessages).toHaveLength(0)
  await say('Hey Jarivs')
  await expect(page.getByText('I’m here. What would you like to do?')).toBeVisible()
  expect(jarvisMessages).toHaveLength(0)
  await page.getByLabel('Message Jarvis').fill('Why is the sky blue?')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Air scatters blue sunlight more than red sunlight.')).toBeVisible()
  await page.getByRole('button', { name: 'Record command', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click()
  await expect(page.getByLabel('Message Jarvis')).toHaveValue('Add 30 euros supermarket')
  expect(transcriptions).toBe(1)
  expect(jarvisMessages).toHaveLength(1)
  await page.getByLabel('Message Jarvis').fill('')
  await page.getByRole('button', { name: 'Enable voice', exact: true }).click()
  await say('Hey Jarvis delete my 30 euro supermarket transaction')
  await expect(
    page.getByText('Heard: Hey Jarvis delete my 30 euro supermarket transaction', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm deletion' })).toBeVisible()
  expect(jarvisMessages).toHaveLength(2)
  await expect(page.getByLabel('Message Jarvis')).toBeInViewport()
  expect(confirmations).toBe(0)
  await page.screenshot({ path: testInfo.outputPath('mobile-320-jarvis-confirmation.png') })
  await page.getByRole('button', { name: 'Confirm deletion' }).click()
  await expect(page.getByText('Deleted: Supermarket · €30.00', { exact: true })).toBeVisible()
  expect(confirmations).toBe(1)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1)
  await say('Jarvis stop')
  await expect(page.getByLabel('Message Jarvis')).toHaveCount(0)
  await say('Hey Jarvis')
  await expect(page.getByLabel('Message Jarvis')).toBeVisible()
  await page.getByRole('button', { name: 'Turn microphone off', exact: true }).click()
})
