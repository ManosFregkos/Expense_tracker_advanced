import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('register, onboard, and complete the core household finance workflow', async ({ page }) => {
  const email = `family-${Date.now()}@example.test`
  await page.goto('/register')
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
  await page.getByLabel('Household name').fill('Fregkos E2E Family')
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Go to accounts' }).click()
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible()

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

  await page.getByRole('button', { name: 'Add transaction' }).first().click()
  await page.getByText('Transfer', { exact: true }).click()
  await page.getByLabel('Amount').fill('100')
  await page.getByRole('textbox', { name: 'From account' }).click()
  await page.getByRole('option', { name: /Eurobank/ }).click()
  await page.getByRole('textbox', { name: 'To account' }).click()
  await page.getByRole('option', { name: /Cash/ }).click()
  await page.getByLabel('Description').fill('Cash withdrawal')
  await page.getByRole('button', { name: 'Save transfer' }).click()
  await expect(page.getByText('Transfer saved')).toBeVisible()

  await page.goto('/dashboard')
  await expect(page.getByText(/€3,000\.00/).first()).toBeVisible()
  await expect(page.getByText(/€72\.43/).first()).toBeVisible()

  await page.goto('/members')
  await page.getByRole('button', { name: 'Invite member' }).click()
  await page.getByLabel('Email').fill('spouse@example.test')
  await page.getByRole('button', { name: 'Create invitation' }).click()
  await expect(page.getByText('spouse@example.test')).toBeVisible()

  await page.goto('/transactions?period=THIS_YEAR')
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
})
