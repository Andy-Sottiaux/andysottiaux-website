import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

test('focused live sections remain usable at 320px without starting private work', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await mockPortfolioNetwork(page)
  const privateRequests: string[] = []
  page.on('request', (request) => { if (/\/api\/v3\/(?:camera|camera2|detections|training|fan)/.test(request.url())) privateRequests.push(request.url()) })
  await page.goto('/preview')
  const power = page.getByRole('button', { name: 'Open power details' })
  await power.click()
  const dialog = page.getByRole('dialog', { name: 'Field Live' })
  await expect(dialog.getByRole('tab', { name: 'power', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByLabel('Energy flow')).toBeVisible()
  for (const name of ['overview', 'camera', 'diagnostics', 'power']) {
    await dialog.getByRole('tab', { name, exact: true }).click()
    const overflow = await dialog.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>('[role="tabpanel"]')).filter(panel => !panel.hidden).some(panel => panel.scrollWidth > panel.clientWidth + 1))
    expect(overflow, name).toBe(false)
    expect((await new AxeBuilder({ page }).analyze()).violations, name).toEqual([])
  }
  await dialog.getByRole('tab', { name: 'power', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('tab', { name: 'diagnostics', exact: true })).toBeFocused()
  await expect(dialog.getByRole('tab', { name: 'power', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('tab', { name: 'diagnostics', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(power).toBeFocused()
  await page.getByRole('button', { name: 'Open system diagnostics' }).click()
  await expect(page.getByRole('tab', { name: 'diagnostics', exact: true })).toHaveAttribute('aria-selected', 'true')
  expect(privateRequests).toEqual([])
})

test('health stays visible and does not invent success, measurements or source freshness', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.route('**/api/v3/health', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: true, telemetry: { observed_at: Date.now() - 3600000, received_at: Date.now(), age_seconds: 3600, stale: true }, system: { rknn_detector: { ok: true, target_fps: 1 }, media_graph: { working: true } } }) }))
  await page.goto('/lab')
  await page.getByRole('tab', { name: 'diagnostics', exact: true }).click()
  const health = page.getByLabel('System health', { exact: true })
  await expect(health).toContainText('Stale')
  await expect(health).not.toContainText('checked now')
  await expect(health).toContainText('Not reported')
  await expect(health).not.toContainText('1.0 FPS')
  await expect(page.getByRole('button', { name: 'Unlock access', exact: true })).toBeVisible()
})

test('health subscribers share one poll and hidden tabs stop telemetry requests', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.clock.install()
  const calls: string[] = []
  page.on('request', request => { const path = new URL(request.url()).pathname; if (['/api/v3/health', '/api/v3/solar', '/api/v3/solar/history'].includes(path)) calls.push(path) })
  await page.goto('/preview')
  await page.getByRole('button', { name: 'Open system diagnostics' }).click()
  await expect(page.getByRole('dialog', { name: 'Field Live' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  calls.length = 0
  await page.clock.runFor(16000)
  await expect.poll(() => calls.filter(path => path === '/api/v3/health').length).toBe(1)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  calls.length = 0
  await page.clock.fastForward(120000)
  expect(calls).toEqual([])
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.clock.runFor(1000)
  await expect.poll(() => calls.filter(path => path === '/api/v3/health').length).toBe(1)
})

test('an unavailable health source still exposes diagnostics and an unlock action', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.route('**/api/v3/health', route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false,"error":"upstream_unreachable"}' }))
  await page.goto('/lab')
  await page.getByRole('tab', { name: 'diagnostics', exact: true }).click()
  await expect(page.getByLabel('System health', { exact: true })).toContainText('Unavailable')
  await expect(page.getByRole('button', { name: 'Unlock access', exact: true })).toBeVisible()
})
