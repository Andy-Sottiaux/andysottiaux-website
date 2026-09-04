import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { SPOTLIGHT_ROTATION_MS } from '../components/portfolio/content'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const TEST_PASSWORD = 'test-device-control-password'

async function openDashboard(
  page: import('@playwright/test').Page,
  reducedMotion: 'reduce' | 'no-preference' = 'reduce',
) {
  await page.emulateMedia({ reducedMotion })
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250) + 1}`,
  })
  await mockPortfolioNetwork(page)
  await page.goto('/lab/dashboard')
  await expect(page.getByText('Andy Sottiaux').first()).toBeVisible()
  await expect(page.getByText('Spotlight').first()).toBeVisible()
}

test('renders the bento shell and spotlight order', async ({ page }) => {
  await openDashboard(page)

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

test('uses polished directional motion between spotlight items', async ({ page }) => {
  await page.clock.install()
  await openDashboard(page, 'no-preference')
  // Hold the transition timer while inspecting it, independent of machine load.
  await page.clock.pauseAt(new Date(Date.now() + 1_000))

  await page.getByRole('tab', { name: 'Travel' }).click()
  const forwardSlide = page.locator('.spotlight-slide[aria-hidden="false"]')
  const forwardMotion = await forwardSlide.evaluate((slide) => {
    const content = slide.querySelector<HTMLElement>('.spotlight-slide-content')
    const style = content ? window.getComputedStyle(content) : null
    const leaving = document.querySelectorAll('.spotlight-slide[data-spotlight-state="leaving"]')
    const leavingContent = leaving[0]?.querySelector<HTMLElement>('.spotlight-slide-content')
    return {
      entering: {
        animationName: style?.animationName,
        animationDuration: style?.animationDuration,
        direction: slide.getAttribute('data-spotlight-direction'),
        state: slide.getAttribute('data-spotlight-state'),
      },
      leaving: {
        count: leaving.length,
        animationName: leavingContent ? window.getComputedStyle(leavingContent).animationName : null,
      },
    }
  })

  expect(forwardMotion.entering).toEqual({
    animationName: 'spotlight-enter-forward',
    animationDuration: expect.stringMatching(/^0\.[5-8]\d?s$/),
    direction: 'forward',
    state: 'active',
  })
  expect(forwardMotion.leaving).toEqual({
    count: 1,
    animationName: 'spotlight-leave-forward',
  })
  const leavingSlide = page.locator('.spotlight-slide[data-spotlight-state="leaving"]')
  await page.clock.runFor(700)
  await expect(leavingSlide).toHaveCount(0, { timeout: 1_500 })
  await expect(forwardSlide).toHaveAttribute('data-spotlight-animate', 'false')

  await page.getByRole('tab', { name: 'E-Paper' }).click()
  const backwardSlide = page.locator('.spotlight-slide[aria-hidden="false"]')
  const backwardMotion = await backwardSlide.evaluate((slide) => {
    const content = slide.querySelector<HTMLElement>('.spotlight-slide-content')
    return {
      direction: slide.getAttribute('data-spotlight-direction'),
      animationName: content ? window.getComputedStyle(content).animationName : null,
    }
  })
  expect(backwardMotion).toEqual({
    direction: 'backward',
    animationName: 'spotlight-enter-backward',
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('tab', { name: 'WYZECAR' }).click()
  const reducedSlide = page.locator('.spotlight-slide[aria-hidden="false"]')
  await expect(reducedSlide.locator('.spotlight-slide-content')).toHaveCSS('animation-name', 'none')
  await expect(page.getByRole('button', { name: /spotlight rotation/i })).toHaveCount(0)
})

test('supports keyboard navigation across the spotlight rail', async ({ page }) => {
  await openDashboard(page)

  const ePaper = page.getByRole('tab', { name: 'E-Paper' })
  const travel = page.getByRole('tab', { name: 'Travel' })
  await ePaper.focus()
  await page.keyboard.press('ArrowRight')
  await expect(travel).toBeFocused()
  await expect(travel).toHaveAttribute('aria-selected', 'true')
  await expect(ePaper).toHaveAttribute('tabindex', '-1')

  await page.keyboard.press('End')
  const cam2 = page.getByRole('tab', { name: 'Cam 2' })
  await expect(cam2).toBeFocused()
  await expect(cam2).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('Home')
  await expect(ePaper).toBeFocused()
  await expect(ePaper).toHaveAttribute('aria-selected', 'true')
})

test('lets visitors pause and resume spotlight rotation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')
  await openDashboard(page, 'no-preference')

  const pause = page.getByRole('button', { name: 'Pause spotlight rotation' })
  await pause.click()
  const resume = page.getByRole('button', { name: 'Resume spotlight rotation' })
  await expect(resume).toBeVisible()
  await page.waitForTimeout(SPOTLIGHT_ROTATION_MS + 300)
  await expect(page.getByRole('tab', { name: 'E-Paper' })).toHaveAttribute('aria-selected', 'true')

  await resume.click()
  await expect(page.getByRole('button', { name: 'Pause spotlight rotation' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Travel' })).toHaveAttribute('aria-selected', 'true', {
    timeout: SPOTLIGHT_ROTATION_MS + 1_500,
  })
})

test('keeps an outgoing camera active until its spotlight transition settles', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')
  await page.clock.install()
  await openDashboard(page, 'no-preference')

  await page.getByRole('tab', { name: 'Cam 1' }).click()
  await page.getByRole('button', { name: 'Unlock Cam 1 live stream' }).click()
  const authDialog = page.getByRole('dialog', { name: 'Camera & device access' })
  await authDialog.getByLabel('Access password').fill(TEST_PASSWORD)
  await authDialog.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(authDialog).toHaveCount(0)

  const cam1Slide = page.locator('#spotlight-panel-cam1')
  const cam1Panel = cam1Slide.locator('[data-spotlight-camera-panel="true"]')
  await expect(cam1Panel).toHaveAttribute('data-stream-enabled', 'true')
  await page.clock.pauseAt(new Date(Date.now() + 1_000))
  await page.getByRole('tab', { name: 'Travel' }).click()
  await expect(cam1Slide).toHaveAttribute('data-spotlight-state', 'leaving')
  await expect(cam1Panel).toHaveAttribute('data-stream-enabled', 'true')
  await page.clock.runFor(700)
  await expect(cam1Slide).toHaveAttribute('data-spotlight-state', 'idle', { timeout: 1_500 })
  await expect(cam1Panel).toHaveAttribute('data-stream-enabled', 'false')
})

test('gives the profile portrait room without overflowing the identity tile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')
  await page.setViewportSize({ width: 1024, height: 768 })
  await openDashboard(page)

  for (const viewport of [
    { width: 1024, height: 768, minimumPortrait: 90 },
    { width: 1180, height: 820, minimumPortrait: 100 },
    { width: 1280, height: 720, minimumPortrait: 96 },
    { width: 1280, height: 500, minimumPortrait: 64 },
  ]) {
    await page.setViewportSize(viewport)
    const portrait = page.getByRole('img', { name: 'Andy Sottiaux' })
    const heading = page.getByRole('heading', { level: 1, name: 'Andy Sottiaux' })
    const cta = page.getByRole('link', { name: 'Get in touch' })
    const trigger = page.getByRole('button', { name: 'Open About' })
    const metrics = await portrait.evaluate((image) => {
      const frame = image.parentElement
      const tile = image.closest<HTMLElement>('[data-peek-target="true"]')

      return {
        portraitWidth: frame?.getBoundingClientRect().width ?? 0,
        tileClientHeight: tile?.clientHeight ?? 0,
        tileScrollHeight: tile?.scrollHeight ?? 0,
        tileClientWidth: tile?.clientWidth ?? 0,
        tileScrollWidth: tile?.scrollWidth ?? 0,
      }
    })
    const textMetrics = await Promise.all([
      heading.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        rect: element.getBoundingClientRect().toJSON(),
      })),
      cta.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
      trigger.evaluate((element) => element.getBoundingClientRect().toJSON()),
    ])

    const [headingMetrics, ctaMetrics, triggerRect] = textMetrics
    const headingOverlapsTrigger = !(
      headingMetrics.rect.right <= triggerRect.left
      || headingMetrics.rect.left >= triggerRect.right
      || headingMetrics.rect.bottom <= triggerRect.top
      || headingMetrics.rect.top >= triggerRect.bottom
    )

    expect(metrics.portraitWidth).toBeGreaterThanOrEqual(viewport.minimumPortrait)
    expect(metrics.tileScrollHeight).toBe(metrics.tileClientHeight)
    expect(metrics.tileScrollWidth).toBe(metrics.tileClientWidth)
    expect(headingMetrics.scrollWidth).toBeLessThanOrEqual(headingMetrics.clientWidth)
    expect(headingOverlapsTrigger).toBe(false)
    expect(ctaMetrics.scrollWidth).toBeLessThanOrEqual(ctaMetrics.clientWidth)
    expect(ctaMetrics.height).toBeLessThanOrEqual(32)
    await expect(heading).toBeVisible()
    await expect(cta).toBeVisible()
  }

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'Open About' }).click()
  const modalPortrait = page.getByRole('dialog', { name: 'About Andy' }).getByRole('img', { name: 'Andy Sottiaux' })
  const modalMetrics = await modalPortrait.evaluate((image) => {
    const frame = image.parentElement
    const style = frame ? window.getComputedStyle(frame) : null

    return {
      portraitWidth: frame?.getBoundingClientRect().width ?? 0,
      float: style?.cssFloat ?? 'none',
    }
  })

  expect(modalMetrics.portraitWidth).toBeGreaterThanOrEqual(288)
  expect(modalMetrics.float).toBe('left')
})

test('shows the e-paper interface preview and links to its guided case study', async ({ page }) => {
  await openDashboard(page)

  const activeSpotlight = page.locator('.spotlight-slide[aria-hidden="false"]')
  const productPoster = activeSpotlight.locator('[data-epaper-product-poster="true"]')
  await expect(productPoster).toBeVisible()
  await expect(productPoster.locator('canvas')).toHaveCount(0)
  await expect(activeSpotlight.getByRole('img', { name: /four-color runner dashboard/i })).toBeVisible()
  await expect(activeSpotlight.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/work/epaper-dashboard')
})

test('uses the tall spotlight space for the e-paper product dossier', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')
  await page.setViewportSize({ width: 1526, height: 1259 })
  await openDashboard(page)

  const activeSpotlight = page.locator('.spotlight-slide[aria-hidden="false"]')
  const productPoster = activeSpotlight.locator('[data-epaper-product-poster="true"]')
  const posterBox = await productPoster.boundingBox()
  const cardSizing = await productPoster.evaluate((poster) => ({
    clientHeight: poster.parentElement?.clientHeight ?? 0,
    scrollHeight: poster.parentElement?.scrollHeight ?? 0,
  }))

  expect(posterBox).not.toBeNull()
  expect((posterBox?.width ?? 0) / (posterBox?.height ?? 1)).toBeCloseTo(2, 1)
  expect(cardSizing.scrollHeight).toBe(cardSizing.clientHeight)
  await expect(activeSpotlight.getByText('Runner-first command center')).toBeVisible()
  await expect(activeSpotlight.getByLabel('E-paper dashboard specifications')).toContainText('10.85″')
  await expect(activeSpotlight.getByLabel('E-paper dashboard specifications')).toContainText('1360 × 480')
  await expect(activeSpotlight.getByLabel('E-paper dashboard specifications')).toContainText('4-color')
})

test('opens and closes primary modals', async ({ page }) => {
  await openDashboard(page)
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
  await openDashboard(page)

  await page.getByRole('tab', { name: 'Cam 1' }).click()
  await expect(page.getByRole('button', { name: 'Unlock Cam 1 live stream' })).toBeVisible()

  await page.getByRole('tab', { name: 'Cam 2' }).click()
  await expect(page.getByRole('button', { name: 'Unlock Cam 2 live stream' })).toBeVisible()
})

test('requires a new camera opt-in after closing a modal', async ({ page }) => {
  await openDashboard(page)

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
  await openDashboard(page)

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
  await openDashboard(page)

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

test('@a11y dashboard has no serious automated accessibility regressions', async ({ page }) => {
  await openDashboard(page)

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})
