import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)

test('notes: everyday capture, course study, review, recovery, backup, and mobile reading', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000)
  const email = `notes-${Date.now()}@example.test`
  await page.goto('/register')
  await page.getByLabel('Your name').fill('Notes Test')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('DemoPass123!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  await execFileAsync(process.execPath, [resolve('tests/e2e/helpers/verify-user.mjs'), email], {
    env: { ...process.env, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199' },
  })
  await page.getByRole('button', { name: 'I have verified my email' }).click()
  await page.getByLabel('Household name').fill('Notes Household')
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Go to accounts' }).click()
  await page.getByRole('link', { name: 'Notes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Notes.' })).toBeVisible()
  await page.getByRole('button', { name: /Today’s page/ }).click()
  await expect(page.getByLabel('Note title')).toHaveValue(/^Daily/)
  await page.getByRole('checkbox', { name: 'My first priority' }).check()
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  expect(await page.getByLabel('Note body').inputValue()).toContain('- [x] My first priority')
  await page.getByRole('button', { name: 'All notes', exact: true }).first().click()
  await page.getByRole('button', { name: /Courses/ }).click()
  await page.getByRole('button', { name: /Add a course/ }).click()
  await page.getByLabel('Notebook title').fill('React on Udemy')
  await page.getByLabel('Course URL').fill('https://www.udemy.com/course/react/')
  await page.getByLabel('Instructor / author').fill('My teacher')
  await page.getByLabel('Total lessons').fill('10')
  await page.getByRole('button', { name: 'Save notebook' }).click()
  await page
    .getByRole('button', { name: /React on Udemy/ })
    .last()
    .click()
  await page.getByRole('button', { name: 'New note', exact: true }).click()
  await page.getByRole('button', { name: /Course lesson/ }).click()
  await page.getByLabel('Note title').fill('Understanding hooks')
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  await page
    .getByLabel('Note body')
    .fill(
      '## Hooks\n\nState persists between renders.\n\n- [ ] Build a counter\n\n```js\nconst [count, setCount] = useState(0)\n```',
    )
  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hooks', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mark lesson complete' }).click()
  await page.getByRole('button', { name: 'Pin note', exact: true }).click()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByLabel('Tags', { exact: true }).fill('react, hooks')
  await page.getByLabel('Lesson / chapter').fill('Section 2 · Lesson 4')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Add review card' }).click()
  await page
    .getByRole('textbox', { name: 'Question', exact: true })
    .fill('What persists between renders?')
  await page.getByRole('textbox', { name: 'Answer', exact: true }).fill('State.')
  await page.getByRole('button', { name: 'Save review card' }).click()
  await page.reload()
  await expect(page.getByLabel('Note title')).toHaveValue('Understanding hooks')
  await expect(page.getByRole('button', { name: 'Completed · mark incomplete' })).toBeVisible()
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click()
  await expect(page.locator('.nt-editor')).toHaveClass(/is-focused/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.nt-editor')).not.toHaveClass(/is-focused/)
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  const savedBody = await page.getByLabel('Note body').inputValue()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('everyday-notes.'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      original.call(this, key, value)
    }
    Object.defineProperty(window, 'restoreNotesStorage', {
      configurable: true,
      value: () => {
        Storage.prototype.setItem = original
      },
    })
  })
  await page.getByLabel('Note body').fill(`${savedBody}\n\nKeep this unsaved thought.`)
  await expect(page.getByText('Unsaved draft', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Pinned\s/ }).click()
  await page.getByRole('button', { name: /Understanding hooks/ }).click()
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  expect(await page.getByLabel('Note body').inputValue()).toContain('Keep this unsaved thought.')
  await page.evaluate(() => {
    ;(window as unknown as { restoreNotesStorage: () => void }).restoreNotesStorage()
  })
  await page.getByRole('button', { name: 'Retry save' }).click()
  await expect(page.getByText('Unsaved draft', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^Review\s/ }).click()
  await page.getByRole('button', { name: 'Reveal answer' }).click()
  await expect(page.getByText('State.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Got it', exact: true }).click()
  await expect(page.getByText('1 cards reviewed this session')).toBeVisible()
  await page.getByRole('button', { name: /^All notes\s/ }).click()
  await page.getByLabel('Search notes').fill('understanding hooks')
  await page.getByRole('button', { name: /Understanding hooks/ }).click()
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  await page.getByLabel('Note body').fill('A newer version of the note.')
  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await page.getByRole('button', { name: 'Note history' }).click()
  await page.getByRole('button', { name: 'Restore this version' }).first().click()
  await expect(page.getByRole('heading', { name: 'Hooks', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await page.getByRole('button', { name: /^Trash\s/ }).click()
  await page.getByRole('button', { name: /Understanding hooks/ }).click()
  await page.getByRole('button', { name: 'Restore note', exact: true }).click()
  await page.getByRole('button', { name: 'All notes', exact: true }).first().click()
  await page.getByRole('button', { name: /^All notes\s/ }).click()
  await page.getByLabel('Search notes').fill('')
  await page.screenshot({ path: testInfo.outputPath('notes-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('notes-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: /Understanding hooks/ }).click()
  await expect(page.getByRole('heading', { name: 'Hooks', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('notes-mobile-reader.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'All notes', exact: true }).click()
  await page.getByRole('button', { name: 'Library & backup' }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export library backup' }).click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/^notes-backup/)
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1}'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'not a valid' })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles((await download.path())!)
  await page.getByRole('button', { name: 'Merge with my library' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Backup merged' })).toBeVisible()
})
