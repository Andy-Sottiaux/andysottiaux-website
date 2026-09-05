import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const caseStudies = [
  { path: '/work/travel-agent-ai', title: 'Travel Agent AI', proof: 'Wall-clock itinerary time' },
  { path: '/work/field-camera', title: 'Edge-AI Field Camera', proof: 'Private media edge' },
  { path: '/work/wyzecar', title: 'WYZECAR', proof: 'Separated ROS2 responsibilities' },
  { path: '/work/epaper-dashboard', title: "Runner's E-Paper Dashboard", proof: 'Design to the silicon' },
]

test('renders each featured case study as an indexable page', async ({ page }, testInfo) => {
  for (const study of caseStudies) {
    await page.goto(study.path)
    await expect(page.getByRole('heading', { level: 1, name: study.title })).toBeVisible()
    await expect(page.getByText(study.proof, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What I owned' })).toBeVisible()
    await expect(page.getByText('Architecture', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('Validation', { exact: true }).last()).toBeVisible()

    const screenshotPath = testInfo.outputPath(`${study.path.split('/').pop()}-hero.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' })
    await testInfo.attach(`${study.title} hero`, { path: screenshotPath, contentType: 'image/png' })
  }
})

test('walks through the e-paper dashboard capabilities over the real interface', async ({ page }) => {
  await page.goto('/work/epaper-dashboard')

  await expect(page.locator('[data-epaper-product-viewer="true"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'One screen, six purposeful layers' })).toBeVisible()
  await expect(page.getByRole('img', { name: /complete four-color runner dashboard/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Next workout' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E-paper lifecycle' })).toBeVisible()
})

test('renders the live lab with camera selection and case-study navigation', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.goto('/lab')

  await expect(page.getByRole('heading', { level: 1, name: 'Field systems and operational telemetry' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Field-camera case study/ })).toHaveAttribute('href', '/work/field-camera')
  await expect(page.getByRole('heading', { name: 'Inside the field system' })).toBeVisible()
  await page.getByRole('tab', { name: 'camera', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cam 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cam 2', exact: true })).toBeVisible()
})

test('@a11y case study has no serious automated accessibility regressions', async ({ page }) => {
  await page.goto('/work/travel-agent-ai')

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})

test('@a11y e-paper case study has no serious automated accessibility regressions', async ({ page }) => {
  await page.goto('/work/epaper-dashboard')

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})
