import { expect, test, type Request } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('register, onboard, and complete the core household finance workflow', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000)
  // Exercise voice-command UI without native audio or paid AI calls in the emulator suite.
  await page.addInitScript(() => {
    if (!localStorage.getItem('jarvis-language')) localStorage.setItem('jarvis-language', 'en-US')
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: () => undefined,
        getVoices: () => [],
        speak: (utterance: SpeechSynthesisUtterance) =>
          queueMicrotask(() => {
            utterance.onend?.call(utterance, new Event('end') as SpeechSynthesisEvent)
          }),
      },
    })
    // Exercise real browser/controller wiring without hardware audio or paid OpenAI sessions.
    const bridge = window as Window & {
      jarvisVoiceEvent(event: Record<string, unknown>): void
      jarvisVoiceSent: Array<Record<string, unknown>>
      jarvisWake(text: string): void
    }
    bridge.jarvisVoiceSent = []
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class {
        onresult:
          | ((event: {
              resultIndex: number
              results: Array<{ isFinal: boolean; 0: { transcript: string } }>
            }) => void)
          | null = null
        start() {
          bridge.jarvisWake = (text) =>
            this.onresult?.({
              resultIndex: 0,
              results: [{ isFinal: true, 0: { transcript: text } }],
            })
        }
        abort() {}
      },
    })
    const track = { enabled: true, stop: () => undefined }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }),
    })
    Object.defineProperty(window, 'RTCPeerConnection', {
      configurable: true,
      value: class {
        iceGatheringState = 'complete'
        connectionState = 'connected'
        localDescription: { sdp: string } | null = null
        channel = {
          readyState: 'connecting',
          onopen: null as (() => void) | null,
          onmessage: null as ((event: { data: string }) => void) | null,
          send: (data: string) =>
            bridge.jarvisVoiceSent.push(JSON.parse(data) as Record<string, unknown>),
          close: () => undefined,
        }
        createDataChannel() {
          bridge.jarvisVoiceEvent = (event) =>
            this.channel.onmessage?.({ data: JSON.stringify(event) })
          return this.channel
        }
        addTrack() {}
        close() {}
        async createOffer() {
          return { type: 'offer', sdp: 'v=0\r\noffer' }
        }
        async setLocalDescription(offer: { sdp: string }) {
          this.localDescription = offer
        }
        async setRemoteDescription() {
          this.channel.readyState = 'open'
          this.channel.onopen?.()
        }
      },
    })
  })
  await page.route('**/jarvisStartRealtime', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { sdp: 'v=0\r\nanswer', model: 'gpt-realtime-2.1-mini' } }),
    }),
  )
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
  await page.setViewportSize({ width: 320, height: 844 })
  await page.getByRole('button', { name: 'Open Jarvis assistant' }).click()
  await page.getByLabel('Ask Jarvis').fill('Hello Jarvis')
  await page.getByRole('button', { name: 'Send question' }).click()
  await expect(page.getByRole('log').getByText('Hello Sir', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-jarvis.png') })
  await page.getByLabel('Ask Jarvis').fill('Jarvis stop', { timeout: 5000 })
  await page.getByRole('button', { name: 'Send question' }).click({ timeout: 5000 })
  await expect(page.getByRole('log').getByText('Goodbye sir', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn microphone off' })).toBeDisabled()
  await page.getByRole('button', { name: 'Close Jarvis', exact: true }).click({ timeout: 5000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'Open Jarvis assistant' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('textbox', { name: 'Voice input language' }).click()
  await page.getByRole('option', { name: 'Greek' }).click()
  await page.getByRole('button', { name: 'Ενεργοποίηση μικροφώνου', exact: true }).click()
  await expect(page.getByText('Περιμένω το «Γεια σου Τζάρβις»', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Κλείσιμο Τζάρβις', exact: true }).click()
  await page.evaluate(() =>
    (window as Window & { jarvisWake(text: string): void }).jarvisWake('Hello Jarvis'),
  )
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Σας ακούω', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const bridge = window as Window & { jarvisVoiceEvent(event: Record<string, unknown>): void }
    bridge.jarvisVoiceEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'q1',
      transcript: 'Τι μπορώ να μαγειρέψω;',
    })
  })
  await expect(
    page.getByRole('log').getByText('Τι μπορώ να μαγειρέψω;', { exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    const bridge = window as Window & { jarvisVoiceEvent(event: Record<string, unknown>): void }
    bridge.jarvisVoiceEvent({ type: 'response.created', response: { id: 'r1' } })
    bridge.jarvisVoiceEvent({
      type: 'response.output_audio_transcript.done',
      response_id: 'r1',
      transcript: 'Μπορείτε να φτιάξετε μια ομελέτα, κύριε.',
    })
    bridge.jarvisVoiceEvent({
      type: 'response.done',
      response: { id: 'r1', status: 'completed', output: [] },
    })
    bridge.jarvisVoiceEvent({ type: 'output_audio_buffer.stopped', response_id: 'r1' })
  })
  await expect(
    page.getByRole('log').getByText('Μπορείτε να φτιάξετε μια ομελέτα, κύριε.'),
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-jarvis.png') })
  await page.getByRole('button', { name: 'Κλείσιμο Τζάρβις', exact: true }).click({ timeout: 5000 })
  await page.evaluate(() => {
    const bridge = window as Window & { jarvisVoiceEvent(event: Record<string, unknown>): void }
    bridge.jarvisVoiceEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'stop',
      transcript: 'Τζάρβις σταμάτα',
    })
  })
  await expect(
    page.getByRole('button', { name: 'Άνοιγμα βοηθού Τζάρβις, Περιμένω το «Γεια σου Τζάρβις»' }),
  ).toBeVisible()
  await page.evaluate(() => {
    const bridge = window as Window & { jarvisWake(text: string): void }
    bridge.jarvisWake('Γεια σου Τζάρβις')
  })
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Σας ακούω', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Απενεργοποίηση μικροφώνου' }).click()
  await expect(page.getByText('Μικρόφωνο κλειστό', { exact: true })).toBeVisible()
  await page.route('**/jarvisChat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          reply:
            'Σήμερα δεν έχετε εργασίες. Δεν υπάρχουν εκπρόθεσμες εργασίες ή καταγεγραμμένες προσεχείς υποχρεώσεις. Δεν υπάρχουν διαθέσιμα έξοδα του μήνα.',
          draft: null,
          sources: [],
          briefing: {
            date: '2026-10-10',
            timeZone: 'Europe/Athens',
            scope: 'household',
            today: { tasks: [], truncated: false },
            overdue: { tasks: [], truncated: false },
            upcomingBills: {
              tasks: [],
              truncated: false,
              throughDate: '2026-10-17',
              listConfigured: false,
              source: 'bill_tasks',
            },
            monthlySpending: {
              month: '2026-10',
              currency: 'EUR',
              currencyMinorDigits: 2,
              expenseMinor: null,
              available: false,
            },
          },
        },
      }),
    }),
  )
  await page.route('**/jarvisSpeak', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { audio: 'AAAA', mimeType: 'audio/mpeg' } }),
    }),
  )
  await page.setViewportSize({ width: 320, height: 844 })
  await page.getByRole('button', { name: 'Πρωινή ενημέρωση', exact: true }).click()
  await expect(page.getByText('Σημερινές εργασίες', { exact: true })).toBeVisible()
  await expect(page.getByText('Έξοδα του μήνα · 2026-10')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-greek-briefing.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('textbox', { name: 'Γλώσσα φωνής και απαντήσεων' }).click()
  await page.getByRole('option', { name: 'Αγγλικά' }).click()
  await page.getByRole('button', { name: 'Close Jarvis', exact: true }).click()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.unroute('**/jarvisChat')
  await page.unroute('**/jarvisSpeak')

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

  // AI proposes changes; real authenticated emulator task APIs perform them only
  // after confirmation. Exercise create, reschedule, and complete end to end.
  let jarvisTaskId = ''
  const jarvisTask = {
    title: 'Jarvis confirmation task',
    status: 'TODO',
    priority: 'NONE',
    tags: [],
    dueDate: '2026-10-12',
    dueTime: null,
    assigneeUserId: null,
    listId: null,
  }
  await page.route('**/jarvisChat', async (route) => {
    const body = route.request().postDataJSON() as {
      data: { messages: Array<{ content: string }> }
    }
    const question = body.data.messages.at(-1)?.content ?? ''
    const taskAction = question.startsWith('Create')
      ? {
          kind: 'create',
          clientRequestId: 'jarvis_e2e_task',
          task: jarvisTask,
          assigneeName: null,
          listName: null,
        }
      : question.startsWith('Reschedule')
        ? {
            kind: 'reschedule',
            taskId: jarvisTaskId,
            expectedVersion: 1,
            task: { ...jarvisTask, dueDate: '2026-10-13' },
            previousDueDate: '2026-10-12',
            previousDueTime: null,
          }
        : {
            kind: 'complete',
            taskId: jarvisTaskId,
            title: jarvisTask.title,
            expectedVersion: 2,
            recurring: false,
          }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: { reply: 'Review the task change, Sir.', draft: null, sources: [], taskAction },
      }),
    })
  })
  await page.route('**/jarvisSpeak', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { audio: 'AAAA', mimeType: 'audio/mpeg' } }),
    }),
  )
  await page.getByRole('button', { name: 'Open Jarvis assistant' }).click()
  await page.getByLabel('Ask Jarvis').fill('Create Jarvis confirmation task')
  await page.getByRole('button', { name: 'Send question' }).click()
  await expect(page.getByRole('button', { name: 'Confirm task change' })).toBeVisible()
  let creates = 0
  const trackCreation = (request: Request) => {
    if (request.url().endsWith('/createTask')) creates++
  }
  page.on('request', trackCreation)
  expect(creates).toBe(0)
  const created = page.waitForResponse((response) => response.url().endsWith('/createTask'))
  await page.getByRole('button', { name: 'Confirm task change' }).click()
  const createdBody = (await (await created).json()) as { result: { taskId: string } }
  jarvisTaskId = createdBody.result.taskId
  await expect(
    page.getByRole('log').getByText('Task created: Jarvis confirmation task.'),
  ).toBeVisible()
  expect(creates).toBe(1)
  page.off('request', trackCreation)
  await page.getByLabel('Ask Jarvis').fill('Reschedule Jarvis confirmation task to October 13')
  await page.getByRole('button', { name: 'Send question' }).click()
  await expect(page.getByText(/Reschedule from 2026-10-12/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm task change' }).click()
  await expect(
    page.getByRole('log').getByText('Task rescheduled: Jarvis confirmation task, 2026-10-13.'),
  ).toBeVisible()
  await page.getByLabel('Ask Jarvis').fill('Complete Jarvis confirmation task')
  await page.getByRole('button', { name: 'Send question' }).click()
  await page.getByRole('button', { name: 'Confirm task change' }).click()
  await expect(
    page.getByRole('log').getByText('Task completed: Jarvis confirmation task.'),
  ).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Jarvis confirmation task', { exact: true })).toHaveCount(0)
  await page.unroute('**/jarvisChat')
  await page.unroute('**/jarvisSpeak')

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
})
