import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('complete Learn & Choose with TV input and rapid Enter protection', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const email = `kids-${Date.now()}@example.test`
  await page.goto('/register')
  await page.getByLabel('Your name').fill('Kids Parent')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('DemoPass123!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await execFileAsync(process.execPath, [resolve('tests/e2e/helpers/verify-user.mjs'), email], {
    env: { ...process.env, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199' },
  })
  await page.getByRole('button', { name: 'I have verified my email' }).click()
  await page.getByLabel('Household name').fill('Kids E2E Family')
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.goto('/settings/kids')
  await page.getByLabel('New profile name').fill('Niko')
  await page.getByRole('button', { name: 'Create profile' }).click()
  await expect(page.getByLabel('Active profile')).toContainText('Niko')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/kids')
  await expect(page.getByRole('heading', { name: 'Τι θέλεις να κάνουμε;' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('kids-tv-hub.png') })
  await page.goto('/kids/play/LEARN_AND_CHOOSE/animals')

  for (let round = 0; round < 5; round += 1) {
    await expect(page.getByRole('heading', { name: 'Ας γνωρίσουμε τις κάρτες!' })).toBeVisible()
    await page.keyboard.press('Enter')
    const question = page.getByRole('heading', { name: /^Πού είναι/ })
    await expect(question).toBeVisible()
    const target =
      (await question.textContent())?.replace('Πού είναι ', '').replace(/[;?]$/, '') ?? ''
    const labels = await page
      .locator('button.learning-card')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''))
    const targetIndex = labels.findIndex((label) => label.includes(target))
    expect(targetIndex).toBeGreaterThanOrEqual(0)
    for (let index = 0; index < targetIndex; index += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    if (round === 0) {
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
    }
    await expect(page.getByRole('status')).toContainText('Μπράβο')
  }
  await expect(page.getByRole('heading', { name: 'Μπράβο! Παίξαμε μαζί!' })).toBeVisible()
  await page.setViewportSize({ width: 3840, height: 2160 })
  await page.screenshot({ path: testInfo.outputPath('kids-4k-complete.png') })
})
