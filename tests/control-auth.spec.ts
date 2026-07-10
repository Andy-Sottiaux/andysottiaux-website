import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

const TEST_PASSWORD = 'test-device-control-password'

test('denies physical writes without a control session', async ({ request }) => {
  const status = await request.get('/api/v3/control-auth')
  expect(status.ok()).toBeTruthy()
  await expect(status.json()).resolves.toMatchObject({ configured: true, authenticated: false })

  const requests = [
    request.post('/api/v3/control-auth/ticket'),
    request.post('/api/v3/fan', { data: { speed: 25, ttl_sec: 30 } }),
    request.post('/api/v3/camera2/control', { data: { command: 'stop' } }),
    request.post('/api/v3/camera2/settings', { data: { preset: 'balanced24' } }),
  ]

  for (const pending of requests) {
    const response = await pending
    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'control_auth_required' })
  }
})

test('creates a signed control session after the correct password', async ({ request }) => {
  const denied = await request.post('/api/v3/control-auth', { data: { password: 'incorrect' } })
  expect(denied.status()).toBe(401)

  const unlocked = await request.post('/api/v3/control-auth', { data: { password: TEST_PASSWORD } })
  expect(unlocked.ok()).toBeTruthy()
  await expect(unlocked.json()).resolves.toMatchObject({ ok: true, authenticated: true })

  const status = await request.get('/api/v3/control-auth')
  await expect(status.json()).resolves.toMatchObject({ configured: true, authenticated: true })

  const ticket = await request.post('/api/v3/control-auth/ticket')
  expect(ticket.ok()).toBeTruthy()
  const ticketBody = await ticket.json() as { ticket?: string; expiresAt?: number }
  expect(ticketBody.ticket).toMatch(/^ws1\.\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  expect(ticketBody.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
})

test('rejects cross-origin control authentication', async ({ request }) => {
  const response = await request.post('/api/v3/control-auth', {
    headers: { Origin: 'https://example.net' },
    data: { password: TEST_PASSWORD },
  })
  expect(response.status()).toBe(403)
})

test('unlocks controls from the Field Live dialog', async ({ page }) => {
  await mockPortfolioNetwork(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Field Live' }).click()
  await page.getByRole('button', { name: 'Unlock' }).click()

  const authDialog = page.getByRole('dialog', { name: 'Device controls' })
  await expect(authDialog).toBeVisible()
  await authDialog.getByLabel('Control password').fill(TEST_PASSWORD)
  await authDialog.getByRole('button', { name: 'Unlock' }).click()
  await expect(authDialog).toHaveCount(0)
  await expect(page.getByRole('slider', { name: 'Fan speed override' })).toBeEnabled()
})
