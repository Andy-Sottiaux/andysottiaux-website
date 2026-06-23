import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

async function openHome(page: import('@playwright/test').Page) {
  await mockPortfolioNetwork(page)
  await page.goto('/')
  await expect(page.getByText('Andy Sottiaux').first()).toBeVisible()
  await expect(page.getByText('Spotlight').first()).toBeVisible()
}

test('renders the bento shell and spotlight order', async ({ page }) => {
  await openHome(page)

  await expect(page.getByRole('tab', { name: 'Travel' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Cam 1' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'WYZECAR' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Cam 2' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Featured spotlight' }).getByRole('tab')).toHaveText([
    'Travel',
    'Cam 1',
    'WYZECAR',
    'Cam 2',
  ])
})

test('opens and closes primary modals', async ({ page }) => {
  await openHome(page)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Open Field Live' }).click()
  await expect(page.locator('dialog[open]')).toBeVisible()
  await expect(page.locator('dialog[open] h2')).toHaveText('Field Live')
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Travel' }).click()
  await page.locator('.spotlight-slide[aria-hidden="false"]').getByRole('button', { name: /^Details$/ }).click()
  await expect(page.locator('dialog[open] h2')).toHaveText('Projects')
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.locator('[data-modal-trigger="Open About"]').first().click({ position: { x: 20, y: 20 } })
  await expect(page.locator('dialog[open] h2')).toHaveText('About Andy')
})

test('keeps camera feeds opt-in from spotlight tabs', async ({ page }) => {
  await openHome(page)

  await page.getByRole('tab', { name: 'Cam 1' }).click()
  await expect(page.getByRole('button', { name: 'Play Cam 1 live stream' })).toBeVisible()

  await page.getByRole('tab', { name: 'Cam 2' }).click()
  await expect(page.getByRole('button', { name: 'Play Cam 2 live stream' })).toBeVisible()
})

test('@a11y home page has no serious automated accessibility regressions', async ({ page }) => {
  await openHome(page)

  const results = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .analyze()

  expect(results.violations).toEqual([])
})
