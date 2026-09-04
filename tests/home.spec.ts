import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const caseStudyPaths = [
  '/work/epaper-dashboard',
  '/work/travel-agent-ai',
  '/work/field-camera',
  '/work/wyzecar',
]
const systemLayers = ['Mechanical', 'Embedded', 'Software'] as const

async function openHome(page: Page, reducedMotion: 'reduce' | 'no-preference' = 'reduce') {
  await page.emulateMedia({ reducedMotion })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /I build across the boundaries\./ })).toBeVisible()
}

test('introduces Andy and provides direct navigation to work, background, and contact', async ({ page }) => {
  await openHome(page)

  const navigation = page.getByRole('navigation').first()
  for (const href of ['#projects', '#about', '#contact', '/lab']) {
    const link = navigation.locator(`a[href="${href}"]`)
    await expect(link).toBeVisible()
    await expect(link).toHaveAccessibleName(/\S/)
  }

  for (const section of ['projects', 'about', 'contact']) {
    await navigation.locator(`a[href="#${section}"]`).click()
    await expect(page).toHaveURL(new RegExp(`#${section}$`))
    await expect(page.locator(`#${section}`)).toBeInViewport()
  }

  await expect(page.locator('#contact a[href="mailto:andrewsottiaux@gmail.com"]').first()).toBeVisible()
})

test('connects each selected project to its existing case study', async ({ page }, testInfo) => {
  await openHome(page)
  await page.evaluate(() => document.fonts.ready)

  await expect.poll(() => page.getByRole('img', { name: 'Andy Sottiaux', exact: true }).evaluate(
    (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
  )).toBe(true)
  await testInfo.attach('homepage-hero', {
    body: await page.screenshot({
      path: testInfo.outputPath('homepage-hero.png'),
      animations: 'disabled',
    }),
    contentType: 'image/png',
  })

  for (const path of caseStudyPaths) {
    const caseStudy = page.getByRole('main').locator(`a[href="${path}"]`).first()
    await expect(caseStudy).toBeVisible()
    await expect(caseStudy).toHaveAccessibleName(/\S/)
  }

  // Visit each image to trigger native lazy loading before capturing the full
  // page. A jump straight to the footer can leave intermediate images unloaded.
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate(
      (element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
    )).toBe(true)
  }
  await page.locator('#contact').scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await testInfo.attach('homepage-full', {
    body: await page.screenshot({
      path: testInfo.outputPath('homepage-full.png'),
      fullPage: true,
      animations: 'disabled',
    }),
    contentType: 'image/png',
  })
})

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`fits the viewport without horizontal overflow at ${width}px`, async ({ page }) => {
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

test('keeps device API traffic out of the public homepage', async ({ page }) => {
  const deviceRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v3/')) {
      deviceRequests.push(request.url())
    }
  })
  // If a regression starts device polling, fail without reaching physical devices.
  await page.route('**/api/v3/**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Device APIs must not be requested by the homepage.' }),
  }))
  await openHome(page, 'no-preference')
  await page.locator('#contact').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1_500)

  expect(deviceRequests).toEqual([])
})

test('stops private-session checks after returning from the unlocked lab', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.goto('/lab')
  await page.getByRole('button', { name: 'Unlock Cam 1 live stream' }).click()

  const authDialog = page.getByRole('dialog', { name: 'Camera & device access' })
  await authDialog.getByLabel('Access password').fill('test-device-control-password')
  await authDialog.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(authDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock camera access' })).toBeVisible()

  // Follow the client-side link so a globally mounted provider would retain
  // its unlocked state and focus listener across the route transition.
  await page.getByRole('link', { name: 'Back to portfolio' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /I build across the boundaries\./ })).toBeVisible()
  const deviceRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v3/')) {
      deviceRequests.push(request.url())
    }
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(1_000)

  expect(deviceRequests).toEqual([])
})

test('lets visitors inspect each system layer by mouse and keyboard', async ({ page }) => {
  await openHome(page)

  const detail = page.getByRole('region', { name: 'System layer details' })
  const details = new Set<string>()
  for (const layer of systemLayers) {
    const button = page.getByRole('button', { name: layer, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    for (const other of systemLayers.filter((name) => name !== layer)) {
      await expect(page.getByRole('button', { name: other, exact: true })).toHaveAttribute('aria-pressed', 'false')
    }
    await expect(detail).toBeVisible()
    await expect(detail).toContainText(/\S/)
    details.add((await detail.innerText()).trim())
  }
  expect(details.size).toBe(systemLayers.length)

  const mechanical = page.getByRole('button', { name: 'Mechanical', exact: true })
  await mechanical.focus()
  await page.keyboard.press('Enter')
  await expect(mechanical).toHaveAttribute('aria-pressed', 'true')
  await expect(mechanical).toBeFocused()
})

test('keeps content and system controls accessible with reduced motion', async ({ page }) => {
  await openHome(page, 'reduce')

  for (const section of ['projects', 'about', 'contact']) {
    await page.locator(`#${section}`).scrollIntoViewIfNeeded()
    await expect(page.locator(`#${section}`)).toBeInViewport()
    await expect(page.locator(`#${section}`)).toContainText(/\S/)
  }
  await page.getByRole('button', { name: 'Embedded', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Embedded', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'System layer details' })).toBeVisible()
})

test('@a11y homepage has no serious automated accessibility regressions', async ({ page }) => {
  await openHome(page)

  const results = await new AxeBuilder({ page }).analyze()
  const seriousViolations = results.violations.filter((violation) =>
    violation.impact === 'serious' || violation.impact === 'critical',
  )

  expect(seriousViolations).toEqual([])
})
