import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const privateApi = /\/api\/v3\/(?:camera|camera2|control-auth|fan|training|detections)/

async function openHome(page: Page, reducedMotion: 'reduce' | 'no-preference' = 'reduce') {
  await page.emulateMedia({ reducedMotion })
  await mockPortfolioNetwork(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Andy Sottiaux' })).toBeVisible()
}

test('introduces Andy through the personal dashboard and focused detail dialogs', async ({ page }) => {
  await openHome(page)
  for (const [trigger, title] of [
    ['Open About', 'About Andy'],
    ['Open Experience', 'Experience'],
    ['Open Projects', 'Projects'],
    ['Open Contact', 'Contact'],
  ]) {
    const button = page.getByRole('button', { name: trigger, exact: true })
    await button.click()
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(button).toBeFocused()
  }
  await expect(page.getByRole('link', { name: 'Get in touch' })).toHaveAttribute('href', 'mailto:andrewsottiaux@gmail.com')
})

test('connects the restored homepage to every retained case study', async ({ page }) => {
  await openHome(page)
  await expect(page.locator('a[href="/work/epaper-dashboard"]').first()).toBeVisible()
  for (const path of ['/work/travel-agent-ai', '/work/wyzecar']) {
    await expect(page.locator('#projects').locator('a[href="' + path + '"]')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Open system diagnostics' }).click()
  const dialog = page.getByRole('dialog', { name: 'Field Live' })
  await dialog.getByRole('tab', { name: 'overview', exact: true }).click()
  await expect(dialog.getByRole('link', { name: 'Field-camera case study' })).toHaveAttribute('href', '/work/field-camera')
})

for (const width of [320, 360, 390, 768, 1024, 1440]) {
  test('fits the viewport without horizontal overflow at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openHome(page)
    await page.evaluate(() => document.fonts.ready)
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }))
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport)
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport)
  })
}

test('keeps all desktop cards in one screen at common laptop sizes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'))
  await openHome(page)
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1366, height: 668 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }))).toEqual(viewport)
    for (const selector of ['#about', '#now', '#projects', '#experience', '#contact']) {
      await expect(page.locator(selector)).toBeInViewport()
    }
  }
})

test('loads only public telemetry while private camera and controls stay idle', async ({ page }) => {
  const privateRequests: string[] = []
  page.on('request', request => { if (privateApi.test(request.url())) privateRequests.push(request.url()) })
  await openHome(page, 'no-preference')
  for (const name of ['Cam 1', 'Cam 2']) {
    await page.getByRole('tab', { name }).click()
    await expect(page.getByRole('button', { name: 'Unlock ' + name + ' live stream' })).toBeVisible()
  }
  await page.waitForTimeout(1_000)
  expect(privateRequests).toEqual([])
})

test('returning from an unlocked lab never starts private homepage work automatically', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.goto('/lab')
  await page.getByRole('tab', { name: 'camera', exact: true }).click()
  await page.getByRole('button', { name: 'Unlock Cam 1 live stream' }).click()
  const authDialog = page.getByRole('dialog', { name: 'Camera & device access' })
  await authDialog.getByLabel('Access password').fill('test-device-control-password')
  await authDialog.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(authDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock camera access' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to portfolio' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Andy Sottiaux' })).toBeVisible()
  const privateRequests: string[] = []
  page.on('request', request => { if (privateApi.test(request.url())) privateRequests.push(request.url()) })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(1_000)
  expect(privateRequests).toEqual([])
})

test('homepage is indexable and has the canonical production address', async ({ page }) => {
  await openHome(page)
  await expect(page).toHaveTitle('Andy Sottiaux — Engineer & Founder')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://andysottiaux.com')
})

test('@a11y homepage and profile remain accessible with reduced motion', async ({ page }) => {
  await openHome(page)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Open About' }).click()
  await expect(page.getByRole('dialog', { name: 'About Andy' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'About Andy' }).getByRole('img', { name: 'Andy Sottiaux' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
