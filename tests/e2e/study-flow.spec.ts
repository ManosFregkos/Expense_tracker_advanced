import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)

test('study: capture, read, review, restore, and use transcript AI drafts', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000)
  const email = `study-${Date.now()}@example.test`
  await page.goto('/register')
  await page.getByLabel('Your name').fill('Study Test')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('DemoPass123!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  await execFileAsync(process.execPath, [resolve('tests/e2e/helpers/verify-user.mjs'), email], {
    env: { ...process.env, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199' },
  })
  await page.getByRole('button', { name: 'I have verified my email' }).click()
  await page.getByLabel('Household name').fill('Study Household')
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Go to accounts' }).click()
  await page.getByRole('link', { name: /^Study Studio/ }).click()
  await expect(page.getByRole('heading', { name: /^Study Studio/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('study-desktop.png'), fullPage: true })

  await page.getByRole('button', { name: 'Add course', exact: true }).click()
  await page.getByLabel('Course title').fill('My Udemy RAG course')
  await page.getByLabel('Instructor', { exact: true }).fill('My instructor')
  await page.getByRole('button', { name: 'Save course' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Notebook', exact: true }).click()
  await page.getByRole('button', { name: 'Write a note' }).click()
  await page.getByLabel('Lesson title').fill('My first lesson')
  await page
    .getByLabel('Notes (Markdown)')
    .fill('## My takeaway\n\nRetrieval should preserve sources.\n\n```python\nprint("hello")\n```')
  await page.getByLabel('Topics', { exact: true }).fill('RAG, retrieval')
  await page.getByRole('button', { name: 'Save lesson', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My first lesson' })).toBeVisible()
  await page.getByRole('button', { name: 'Mark as read' }).click()
  await expect(page.getByRole('button', { name: 'Read · mark unread' })).toBeVisible()
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click()
  await expect(page.locator('.st-reader')).toHaveClass(/is-focused/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.st-reader')).not.toHaveClass(/is-focused/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My first lesson' })).toBeVisible()
  await page.getByRole('button', { name: 'Read · mark unread' }).click()
  await page.getByRole('button', { name: 'Make a review card' }).click()
  await page.getByLabel('Question', { exact: true }).fill('What should retrieval preserve?')
  await page.getByLabel('Answer', { exact: true }).fill('Source references.')
  await page.getByRole('button', { name: 'Save review card' }).click()
  await page.getByRole('button', { name: /Review cards/ }).click()
  await page.getByRole('button', { name: /Reveal answer/ }).click()
  await page.getByRole('button', { name: /Got it/ }).click()
  await expect(page.getByText(/1 reviews completed/)).toBeVisible()

  // Mock only the callable HTTP boundary; no real provider calls or API key needed.
  await page.route('**/processStudyTranscript', (route) =>
    route.fulfill({
      json: {
        result: {
          title: 'AI lesson',
          summary: 'Grounding an answer.',
          markdown: '## Grounding\n\nUse relevant retrieved sources.',
          tags: ['RAG'],
          flashcards: [{ question: 'Why ground?', answer: 'To use source evidence.' }],
        },
      },
    }),
  )
  await page.getByRole('button', { name: 'Notebook', exact: true }).click()
  await page.getByRole('button', { name: 'Import lesson' }).click()
  await page
    .getByLabel('Lesson transcript')
    .fill('A useful retrieval pipeline keeps source references with each passage. '.repeat(4))
  await page.getByRole('button', { name: 'Generate study notes' }).click()
  await expect(page.getByRole('tab', { name: 'Reading preview' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: 'Save lesson + 1 cards' }).click()
  await expect(page.getByRole('heading', { name: 'AI lesson' })).toBeVisible()

  await page.route('**/askStudyNotes', (route) =>
    route.fulfill({
      json: {
        result: {
          answer: 'Retrieval brings passages into the answer [1].',
          sourceIds: ['rag-pipeline'],
        },
      },
    }),
  )
  await page.getByRole('button', { name: 'Ask my notes', exact: true }).click()
  await page.getByLabel('Your question').fill('What is a RAG pipeline?')
  await page.getByRole('button', { name: 'Ask my library' }).click()
  await expect(page.getByText('Retrieval brings passages into the answer [1].')).toBeVisible()
  await page
    .locator('.st-answer-sources summary')
    .filter({ hasText: 'The anatomy of a RAG pipeline' })
    .click()
  await page.getByRole('button', { name: 'Read full lesson' }).click()
  await expect(page.getByRole('heading', { name: 'The anatomy of a RAG pipeline' })).toBeVisible()

  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: /Build a tiny RAG assistant/ }).click()
  await page.getByRole('button', { name: 'Save lesson', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Build a tiny RAG assistant', exact: true, level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'My implementation' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Lesson title').fill('My RAG project')
  await page.getByRole('button', { name: 'Save lesson', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My RAG project', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Less watching/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('study-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Library settings', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^study-studio.*\.json$/)
  const path = await download.path()
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1}'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'not a valid' })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type=file][accept=".json"]').setInputFiles(path!)
  await expect(page.getByRole('heading', { name: /Less watching/ })).toBeVisible()
  await page.getByRole('button', { name: 'Notebook', exact: true }).click()
  await page.getByLabel('Search study notes').fill('My first lesson')
  await expect(page.getByRole('heading', { name: 'My first lesson' })).toBeVisible()
})
