import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const TEST_PASSWORD = 'test-device-control-password'

async function openHome(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250) + 1}`,
  })
  await mockPortfolioNetwork(page)
  await page.goto('/')
  await expect(page.getByText('Andy Sottiaux').first()).toBeVisible()
  await expect(page.getByText('Spotlight').first()).toBeVisible()
}

test('renders the bento shell and spotlight order', async ({ page }) => {
  await openHome(page)

  await expect(page.getByRole('tab', { name: 'Travel' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Cam 1' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'E-Paper' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'WYZECAR' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Cam 2' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Featured spotlight' }).getByRole('tab')).toHaveText([
    'E-Paper',
    'Travel',
    'Cam 1',
    'WYZECAR',
    'Cam 2',
  ])
  await expect(page.getByRole('tab', { name: 'E-Paper' })).toHaveAttribute('aria-selected', 'true')
})

test('shows the e-paper interface preview and links to its guided case study', async ({ page }) => {
  await openHome(page)

  const activeSpotlight = page.locator('.spotlight-slide[aria-hidden="false"]')
  await expect(activeSpotlight.locator('[data-epaper-product-viewer="true"]')).toBeVisible()
  await expect(activeSpotlight.getByRole('img', { name: /four-color runner dashboard/i })).toBeVisible()
  await expect(activeSpotlight.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/work/epaper-dashboard')
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
  await page.getByRole('button', { name: 'Open Travel Agent AI' }).click()
  await expect(page.locator('dialog[open] h2')).toHaveText('Projects')
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Open About' }).click()
  await expect(page.locator('dialog[open] h2')).toHaveText('About Andy')
})

test('keeps camera feeds opt-in from spotlight tabs', async ({ page }) => {
  await openHome(page)

  await page.getByRole('tab', { name: 'Cam 1' }).click()
  await expect(page.getByRole('button', { name: 'Unlock Cam 1 live stream' })).toBeVisible()

  await page.getByRole('tab', { name: 'Cam 2' }).click()
  await expect(page.getByRole('button', { name: 'Unlock Cam 2 live stream' })).toBeVisible()
})

test('requires a new camera opt-in after closing a modal', async ({ page }) => {
  await openHome(page)

  await page.getByRole('tab', { name: 'Cam 1' }).click()
  const unlock = page.getByRole('button', { name: 'Unlock Cam 1 live stream' })
  await unlock.click()
  const authDialog = page.getByRole('dialog', { name: 'Camera & device access' })
  await authDialog.getByLabel('Access password').fill(TEST_PASSWORD)
  await authDialog.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(authDialog).toHaveCount(0)
  await expect(unlock).toHaveCount(0)

  await page.getByRole('button', { name: 'Open Cam 1' }).click()
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('button', { name: 'Play Cam 1 live stream' })).toBeVisible()
})

test('surfaces Cam1 AI readiness and project validation proof', async ({ page }) => {
  await openHome(page)

  await page.getByRole('button', { name: 'Open Field Live' }).click()
  await page.getByRole('button', { name: 'Unlock Cam 1 live stream' }).click()
  const authDialog = page.getByRole('dialog', { name: 'Camera & device access' })
  await authDialog.getByLabel('Access password').fill(TEST_PASSWORD)
  await authDialog.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(authDialog).toHaveCount(0)
  const aiPanel = page.getByLabel('Cam1 AI training readiness')
  await expect(aiPanel).toBeVisible()
  await expect(aiPanel).toContainText('AI Readiness')
  await expect(aiPanel).toContainText('not training ready')
  await expect(aiPanel).toContainText('package · 23')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Open Projects' }).click()
  await expect(page.locator('dialog[open]')).toContainText('Architecture')
  await expect(page.locator('dialog[open]')).toContainText('Validation')
  await expect(page.locator('dialog[open]')).toContainText('FPS and bitrate budgets')
})

test('links featured projects to full case studies', async ({ page }) => {
  await openHome(page)

  await page.getByRole('tab', { name: 'Travel' }).click()
  const activeSpotlight = page.locator('.spotlight-slide[aria-hidden="false"]')
  await expect(activeSpotlight.getByRole('link', { name: 'Case study' })).toHaveAttribute('href', '/work/travel-agent-ai')

  const caseStudyLink = activeSpotlight.getByRole('link', { name: 'Case study' })
  await Promise.all([
    page.waitForURL(/\/work\/travel-agent-ai$/, { timeout: 15_000 }),
    caseStudyLink.click({ force: true }),
  ])
  await expect(page.getByRole('heading', { level: 1, name: 'Travel Agent AI' })).toBeVisible()
})

test('@a11y home page has no serious automated accessibility regressions', async ({ page }) => {
  await openHome(page)

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})
