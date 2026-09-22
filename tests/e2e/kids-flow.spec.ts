import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('Kids mode supports a five round session, custom content, keyboard play and isolated UI', async ({
  page,
}) => {
  test.setTimeout(240_000)
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
  await page.getByLabel('Household name').fill('Kids E2E')
  await page.getByRole('button', { name: 'Create household' }).click()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  await page.goto('/kids/parent')
  await page.getByLabel('Όνομα').fill('Μικρός')
  await page.getByRole('button', { name: 'Προσθήκη παιδιού' }).click()
  await expect(page.getByText('Αποθηκεύτηκε')).toBeVisible()
  await page.goto('/kids')
  await expect(page.locator('.app-navbar')).toHaveCount(0)
  await expect(page.getByText('Family Finance')).toHaveCount(0)
  if (await page.getByRole('button', { name: /Μικρός/ }).count())
    await page.getByRole('button', { name: /Μικρός/ }).click()
  await expect(page.locator('.kids-hub-cards .kids-button').first()).toBeFocused()
  await page.getByRole('button', { name: /Τι Λείπει/ }).click()
  for (let index = 0; index < 5; index++) {
    await expect(page.getByRole('heading', { name: 'Κοίταξε καλά!' })).toBeVisible()
    await expect(page.locator('.kids-memory-scene .kids-asset').first()).toBeVisible()
    if (index === 1) {
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Κοίταξε καλά!' })).toBeVisible()
      await expect(page.locator('.kids-memory-scene .kids-asset').first()).toBeVisible()
    }
    const original = await page
      .locator('.kids-memory-scene .kids-asset')
      .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))
    await expect(page.locator('.kids-choices .kids-button').first()).toBeVisible({ timeout: 10000 })
    const remaining = await page
      .locator('.kids-memory-scene .kids-asset')
      .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))
    const missing = original.find((item) => !remaining.includes(item))
    expect(missing).toBeTruthy()
    const target = page
      .locator('.kids-choices .kids-button')
      .filter({ has: page.locator(`[aria-label="${missing}"]`) })
    if (index === 0) {
      const wrong = page
        .locator('.kids-choices .kids-button')
        .filter({ hasNot: page.locator(`[aria-label="${missing}"]`) })
        .first()
      await wrong.click()
      await expect(page.getByText('Δοκίμασε ξανά!')).toBeVisible()
      await page.waitForTimeout(400)
    }
    if (index === 2) await page.context().setOffline(true)
    if (index === 0) {
      await target.focus()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
    } else await target.click()
    if (index !== 0) await expect(page.getByText('Μπράβο!', { exact: true })).toBeVisible()
    if (index < 4) await expect(page.getByText('Κοίταξε καλά!')).toBeVisible({ timeout: 5000 })
    if (index === 2) await page.context().setOffline(false)
  }
  await expect(page.getByText('Μπράβο! Τελειώσαμε το παιχνίδι!')).toBeVisible()
  await page.getByRole('button', { name: 'Παιχνίδια' }).click()
  await expect(page.getByRole('heading', { name: 'Παιχνίδια' })).toBeVisible()
  await expect(page).toHaveURL(/\/kids$/)
  await page.keyboard.press('Escape')
  await expect(page.getByText('Πάτησε Πίσω ξανά για γονείς')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Kids · Για γονείς' })).toBeVisible()
  await page.getByRole('button', { name: 'Πρόοδος' }).click()
  await expect(page.getByText(/1 παιχνίδια/)).toBeVisible()
  await expect(page.getByText(/5 γύροι/)).toBeVisible()
  await page.getByRole('button', { name: 'Περιεχόμενο' }).click()
  await page.getByLabel('Τίτλος').fill('Η βροχή')
  await page.getByLabel('Ερώτηση').fill('Βρέχει. Τι κρατάμε;')
  await page.getByRole('button', { name: 'Αποθήκευση' }).click()
  await expect(page.getByText('Αποθηκεύτηκε')).toBeVisible()
  await page.getByRole('button', { name: 'Παιχνίδια' }).click()
  await page.getByRole('button', { name: /Και Μετά Τι/ }).click()
  await expect(page.getByRole('heading', { name: 'Βρέχει. Τι κρατάμε;' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Παιχνίδια' })).toBeVisible()
  await page.getByRole('button', { name: /Μικρός Εξερευνητής/ }).click()
  await page.getByRole('button', { name: /Βυθός/ }).click()
  await expect(page.locator('.kids-hotspot')).toHaveCount(9)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size)
    await expect(page.locator('.kids-root')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1)
  }
})
