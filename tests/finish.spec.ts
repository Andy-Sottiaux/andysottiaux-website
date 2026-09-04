import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const routes = ['/', '/work/epaper-dashboard', '/work/travel-agent-ai', '/work/wyzecar', '/work/field-camera', '/lab']

for (const width of [320, 360, 768, 1440]) {
  test(`finished routes fit ${width}px with working shared navigation`, async ({ page }) => {
    await mockPortfolioNetwork(page)
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('[data-site-navigation]')).toBeVisible()
      const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      expect(size.scroll, route).toBeLessThanOrEqual(size.width)
      const navigation = page.getByRole('navigation', { name: 'Main navigation' })
      await expect(navigation.getByRole('link', { name: 'Selected work' })).toHaveAttribute('href', route === '/' ? '#projects' : '/#projects')
    }
  })
}

test('each project states dated evidence and limitations', async ({ page }) => {
  for (const route of routes.filter(route => route.startsWith('/work/'))) {
    await page.goto(route)
    await expect(page.getByRole('heading', { name: 'What this work demonstrates.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Scope & limitations' })).toBeVisible()
    await expect(page.locator('time[datetime="2026-09-04"]')).toHaveText('Reviewed September 4, 2026')
  }
})

test('native product capture tour loads both real view captures and labels sample data', async ({ page }) => {
  await page.goto('/work/travel-agent-ai')
  const story = page.getByRole('region', { name: /The important step is the review/ })
  await expect(story).toContainText('not a live AI demo')
  for (const name of ['Review before saving', 'Correct the details']) {
    const button = story.getByRole('button', { name: new RegExp(name) })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => story.locator('img').evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true)
  }
  await expect(story.getByRole('link', { name: 'View full size' })).toHaveAttribute('href', '/images/travel-edit-native.webp')
})

test('e-paper explainer supports keyboard and never claims to be a physical recording', async ({ page }) => {
  await page.goto('/work/epaper-dashboard')
  await expect(page.getByText('Driver explanation · not a hardware recording')).toBeVisible()
  const right = page.getByRole('button', { name: 'Right-side update' })
  await right.focus()
  await page.keyboard.press('Enter')
  await expect(right).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-region="right"]')).toBeVisible()
  await page.getByRole('button', { name: 'Across the seam' }).click()
  await expect(page.locator('[data-region="both"]')).toBeVisible()
  await expect(page.getByText('172 hardware-free checks', { exact: true })).toBeVisible()
})

test('lab guide works with every device source unavailable and does not start media', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.route('**/api/v3/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"offline"}' }))
  const mediaRequests: string[] = []
  page.on('request', request => {
    if (/\/api\/v3\/(camera|camera2)\/(snapshot|mjpeg|hls|webrtc|sanitized)/.test(request.url())) mediaRequests.push(request.url())
  })
  await page.goto('/lab')
  await expect(page.getByText('Interactive explanation · not live data')).toBeVisible()
  for (const name of ['Capture', 'Understand', 'Relay', 'Observe']) {
    const button = page.getByRole('button', { name: new RegExp(name) })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(page.getByText('Make failure understandable.')).toBeVisible()
  await expect(page.getByLabel('Cam1 AI training readiness')).toContainText('access-controlled')
  await expect(page.getByLabel('Cam1 AI training readiness')).not.toContainText('services healthy')
  expect(mediaRequests).toEqual([])
})

test('lab retains explicit stale reading state without presenting it as current', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.route('**/api/v3/solar', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ battery_voltage: 13.1, battery_soc: 65, solar_power: 12, live: false, stale: true, age_seconds: 3600, timestamp: Date.now() / 1000 - 3600 }) }))
  await page.goto('/lab')
  await expect(page.getByText('stale', { exact: true }).last()).toBeVisible()
  await expect(page.getByText(/last seen/).last()).toBeVisible()
  await expect(page.locator('[aria-label="Solar power and battery"]')).not.toContainText('NaN')
})

test('public background explicitly separates confidential professional work', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#professional-context')).toContainText('collaborative and confidential')
  await expect(page.locator('#professional-context')).toContainText('independent projects and HatchingPoint products')
})

test('supports a doubled root-font preference without horizontal page overflow', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.setViewportSize({ width: 768, height: 1000 })
  for (const route of ['/', '/work/epaper-dashboard', '/lab']) {
    await page.goto(route)
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(sizes.scroll, route).toBeLessThanOrEqual(sizes.width)
  }
})

test('@a11y new project evidence and public lab guide are accessible', async ({ page }) => {
  await mockPortfolioNetwork(page)
  for (const route of ['/work/wyzecar', '/work/epaper-dashboard', '/lab']) {
    await page.goto(route)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, route).toEqual([])
  }
})
