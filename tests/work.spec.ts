import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const caseStudies = [
  { path: '/work/travel-agent-ai', title: 'Travel Agent AI', proof: 'Wall-clock itinerary time' },
  { path: '/work/field-camera', title: 'Edge-AI Field Camera', proof: 'Read-only public edge' },
  { path: '/work/wyzecar', title: 'WYZECAR', proof: 'Separated ROS2 responsibilities' },
]

test('renders each featured case study as an indexable page', async ({ page }) => {
  for (const study of caseStudies) {
    await page.goto(study.path)
    await expect(page.getByRole('heading', { level: 1, name: study.title })).toBeVisible()
    await expect(page.getByText(study.proof, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What I owned' })).toBeVisible()
    await expect(page.getByText('Architecture', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('Validation', { exact: true }).last()).toBeVisible()
  }
})

test('renders the live lab with camera selection and case-study navigation', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.goto('/lab')

  await expect(page.getByRole('heading', { level: 1, name: 'Field systems and operational telemetry' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Field-camera case study/ })).toHaveAttribute('href', '/work/field-camera')
  await expect(page.getByText('Camera relay, telemetry, and edge-AI health in one surface.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Cam 1/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Cam 2/i })).toBeVisible()
})

test('@a11y case study has no serious automated accessibility regressions', async ({ page }) => {
  await page.goto('/work/travel-agent-ai')

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})
