import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const widgets = [
  { id: 'clock', name: 'Clock' },
  { id: 'weather', name: 'Weather' },
  { id: 'runna', name: 'Runna' },
  { id: 'training', name: 'Training' },
  { id: 'nyc-marathon', name: 'NYC Marathon' },
  { id: 'time-progress', name: 'Time progress' },
  { id: 'claude-usage', name: 'Claude usage' },
]

test('explores all seven firmware views while keeping the example-data boundary visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/work/amoled-dashboard')
  const viewer = page.getByRole('region', { name: 'AMOLED widget preview' })
  await expect(viewer).toHaveAttribute('data-amoled-widget', 'runna')
  await expect(viewer).toContainText('Native LVGL renders · example data')

  for (const widget of widgets) {
    await viewer.getByRole('button', { name: `Show ${widget.name} AMOLED widget`, exact: true }).click()
    await expect(viewer).toHaveAttribute('data-amoled-widget', widget.id)
    await expect.poll(() => viewer.getByRole('img').first().evaluate(image =>
      image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
    )).toBe(true)
  }

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://andysottiaux.com/work/amoled-dashboard')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.getByText('Verified USB + local Wi-Fi', { exact: true })).toBeVisible()
  await expect(page.getByText(/Private feeds require the Mac bridge to remain awake and reachable\. Battery runtime, the office network, and physical swipe\/tap behavior remain unverified/)).toBeVisible()
})

test('navigates the AMOLED widgets with keys independently of the outer Spotlight rail', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockPortfolioNetwork(page)
  await page.goto('/preview')
  const spotlight = page.getByRole('tab', { name: 'AMOLED' })
  await spotlight.click()
  const viewer = page.getByRole('region', { name: 'AMOLED widget preview' })
  const runna = viewer.getByRole('button', { name: 'Show Runna AMOLED widget', exact: true })
  await runna.focus()
  await page.keyboard.press('ArrowRight')
  await expect(viewer).toHaveAttribute('data-amoled-widget', 'training')
  await expect(spotlight).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(viewer).toHaveAttribute('data-amoled-widget', 'claude-usage')
  await page.keyboard.press('Home')
  await expect(viewer).toHaveAttribute('data-amoled-widget', 'clock')
  await page.keyboard.press('ArrowLeft')
  await expect(viewer).toHaveAttribute('data-amoled-widget', 'claude-usage')
  await expect(spotlight).toHaveAttribute('aria-selected', 'true')
})

test('@a11y AMOLED case study remains accessible with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/work/amoled-dashboard')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
