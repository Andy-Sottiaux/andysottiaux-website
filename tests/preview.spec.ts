import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

async function openPreview(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockPortfolioNetwork(page)
  await page.goto('/preview')
  await expect(page.getByRole('heading', { level: 1, name: 'Andy Sottiaux' })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

async function expectControlsNotClipped(page: Page) {
  const clipped = await page.locator('.portfolio-grid').evaluate((grid) => {
    return Array.from(grid.querySelectorAll<HTMLElement>('a, button')).flatMap((element) => {
      if (element.closest('[aria-hidden="true"]') || !element.getClientRects().length) return []
      const box = element.getBoundingClientRect()
      if (!box.width || !box.height) return []
      let ancestor = element.parentElement
      while (ancestor && ancestor !== grid.parentElement) {
        const style = getComputedStyle(ancestor)
        const bounds = ancestor.getBoundingClientRect()
        if (/(hidden|clip)/.test(style.overflowY) && (box.top < bounds.top - 2 || box.bottom > bounds.bottom + 2)) {
          return [`${element.getAttribute('aria-label') || element.textContent?.trim()}: vertical clipping`]
        }
        if (/(hidden|clip)/.test(style.overflowX) && (box.left < bounds.left - 2 || box.right > bounds.right + 2)) {
          return [`${element.getAttribute('aria-label') || element.textContent?.trim()}: horizontal clipping`]
        }
        ancestor = ancestor.parentElement
      }
      return []
    })
  })
  expect(clipped).toEqual([])
}

test('preview keeps every desktop card and spotlight control inside one screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'))
  await openPreview(page)
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1366, height: 668 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
    }))).toEqual(viewport)
    for (const name of ['E-Paper', 'Travel', 'WYZECAR', 'Cam 1', 'Cam 2']) {
      await page.getByRole('tab', { name }).click()
      await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
      await expectControlsNotClipped(page)
    }
    await expect(page.getByRole('link', { name: 'Get in touch' })).toBeInViewport()
    await expect(page.locator('#projects')).toBeInViewport()
    await expect(page.locator('#contact')).toBeInViewport()
  }
})

test('short desktop windows allow scrolling instead of hiding controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'))
  await page.setViewportSize({ width: 1280, height: 500 })
  await openPreview(page)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(500)
  await expectControlsNotClipped(page)
  await page.getByRole('tab', { name: 'Travel' }).click()
  await expectControlsNotClipped(page)
})

test('preview stacks naturally on small screens and supports modal keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPreview(page)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(844)
  }
  const trigger = page.getByRole('button', { name: 'Open About' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'About Andy' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.locator('#contact').scrollIntoViewIfNeeded()
  await expect(page.locator('#contact').getByRole('link', { name: 'Email', exact: true })).toBeVisible()
})

test('preview never requests private media or controls when browsing locked camera tabs', async ({ page }) => {
  const privateRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/v3\/(?:camera2?\/(?:snapshot|hls|webrtc|control|mjpeg|sanitized)|control-auth\/ticket|fan)/.test(request.url())) {
      privateRequests.push(request.url())
    }
  })
  await openPreview(page)
  for (const name of ['Cam 1', 'Cam 2']) {
    await page.getByRole('tab', { name }).click()
    await expect(page.getByRole('button', { name: `Unlock ${name} live stream` })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Open power details' }).click()
  await expect(page.getByRole('dialog', { name: 'Field Live' })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(privateRequests).toEqual([])
})

test('preview retains native sample captures and keeps the current homepage isolated', async ({ page }) => {
  await openPreview(page)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await page.getByRole('tab', { name: 'Travel' }).click()
  await page.locator('[role="tabpanel"][aria-hidden="false"]').getByRole('link', { name: 'Case study' }).click()
  await expect(page).toHaveURL(/\/work\/travel-agent-ai$/)
  await expect(page.getByRole('img', { name: /native review screen with a selected sample/i }).first()).toBeVisible()
  await expect(page.getByText('Native-view captures · sample data.', { exact: false })).toBeVisible()
  const privateRequests: string[] = []
  page.on('request', (request) => { if (request.url().includes('/api/v3/')) privateRequests.push(request.url()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /I build across the boundaries/i })).toBeVisible()
  await expect(page.getByText('Sep 2023 — Present', { exact: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(privateRequests).toEqual([])
})

test('@a11y preview and profile dialog have no automated accessibility violations', async ({ page }) => {
  await openPreview(page)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Open About' }).click()
  await expect(page.getByRole('dialog', { name: 'About Andy' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'About Andy' }).getByRole('img', { name: 'Andy Sottiaux' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
