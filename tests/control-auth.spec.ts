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

test('denies every camera read path without an access session', async ({ request }) => {
  test.setTimeout(60_000)
  const reads = [
    '/api/v3/camera/snapshot',
    '/api/v3/camera/sanitized',
    '/api/v3/camera/mjpeg',
    '/api/v3/camera/hls/clean.m3u8',
    '/api/v3/camera/quality',
    '/api/v3/camera/diagnostics',
    '/api/v3/camera2/snapshot',
    '/api/v3/camera2/mjpeg',
    '/api/v3/camera2/status',
    '/api/v3/camera2/settings',
    '/api/v3/camera2/diagnostics',
    '/api/v3/detections',
    '/api/v3/training/status',
  ]

  const readResponses = await Promise.all(reads.map(async (path) => ({
    path,
    response: await request.get(path),
  })))
  for (const { path, response } of readResponses) {
    expect(response.status(), path).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'camera_auth_required' })
  }

  const offerResponses = await Promise.all(
    ['/api/v3/camera/webrtc/offer', '/api/v3/camera2/webrtc/offer'].map(async (path) => ({
      path,
      response: await request.post(path, {
        headers: { 'Content-Type': 'application/sdp' },
        data: 'invalid offer',
      }),
    })),
  )
  for (const { path, response } of offerResponses) {
    expect(response.status(), path).toBe(401)
  }

  const headResponses = await Promise.all(
    ['/api/v3/camera/snapshot', '/api/v3/camera2/snapshot'].map(async (path) => ({
      path,
      response: await request.head(path),
    })),
  )
  for (const { path, response } of headResponses) {
    expect(response.status(), `HEAD ${path}`).toBe(401)
  }
})

test('creates a signed control session after the correct password', async ({ request }) => {
  const denied = await request.post('/api/v3/control-auth', { data: { password: 'incorrect' } })
  expect(denied.status()).toBe(401)

  const unlocked = await request.post('/api/v3/control-auth', { data: { password: TEST_PASSWORD } })
  expect(unlocked.ok()).toBeTruthy()
  await expect(unlocked.json()).resolves.toMatchObject({ ok: true, authenticated: true })

  const sessionCookie = unlocked.headers()['set-cookie']
  expect(sessionCookie).toMatch(/;\s*Secure(?:;|$)/i)
  expect(sessionCookie).toMatch(/;\s*HttpOnly(?:;|$)/i)
  expect(sessionCookie).toMatch(/;\s*SameSite=strict(?:;|$)/i)
  // APIRequestContext correctly withholds Secure cookies on local HTTP. Replay
  // the server-issued cookie for these API contract checks, while browser tests
  // cover the actual cookie flow on Chromium's trustworthy loopback origin.
  const sessionHeaders = { Cookie: sessionCookie.split(';', 1)[0] }

  const status = await request.get('/api/v3/control-auth', { headers: sessionHeaders })
  await expect(status.json()).resolves.toMatchObject({ configured: true, authenticated: true })

  const ticket = await request.post('/api/v3/control-auth/ticket', { headers: sessionHeaders })
  expect(ticket.ok()).toBeTruthy()
  const ticketBody = await ticket.json() as { ticket?: string; expiresAt?: number }
  expect(ticketBody.ticket).toMatch(/^ws1\.\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  expect(ticketBody.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  expect(ticketBody.expiresAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 31)

  const crossOriginRead = await request.get('/api/v3/camera/snapshot', {
    headers: { ...sessionHeaders, Origin: 'https://example.net' },
  })
  expect(crossOriginRead.status()).toBe(403)

  const crossOriginOffer = await request.post('/api/v3/camera/webrtc/offer', {
    headers: {
      ...sessionHeaders,
      'Content-Type': 'application/sdp',
      Origin: 'https://example.net',
    },
    data: 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96',
  })
  expect(crossOriginOffer.status()).toBe(403)

  const gatedOffer = await request.post('/api/v3/camera/webrtc/offer', {
    headers: { ...sessionHeaders, 'Content-Type': 'application/sdp' },
    data: 'invalid offer',
  })
  expect(gatedOffer.status()).toBe(400)
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
  await page.goto('/lab/dashboard')
  await page.getByRole('button', { name: 'Open Field Live' }).click()
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()

  const authDialog = page.getByRole('dialog', { name: 'Camera & device access' })
  await expect(authDialog).toBeVisible()
  await authDialog.getByLabel('Access password').fill(TEST_PASSWORD)
  await authDialog.getByRole('button', { name: 'Unlock' }).click()
  await expect(authDialog).toHaveCount(0)
  await expect(page.getByRole('slider', { name: 'Fan speed override' })).toBeEnabled()

  await page.getByRole('button', { name: 'Lock camera access' }).click()
  await expect(page.getByRole('slider', { name: 'Fan speed override' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Unlock Cam 1 live stream' })).toBeVisible()
  await expect.poll(async () => {
    const response = await page.request.get('/api/v3/control-auth')
    return (await response.json() as { authenticated?: boolean }).authenticated
  }).toBe(false)
})

test('does not request camera media until the viewer unlocks it', async ({ page }) => {
  const mediaRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/v3\/(?:camera|camera2)\/(?:snapshot|mjpeg|hls|webrtc)/.test(request.url())) {
      mediaRequests.push(request.url())
    }
  })
  await mockPortfolioNetwork(page)
  await page.goto('/lab/dashboard')
  await page.getByRole('tab', { name: 'Cam 1' }).click()

  await expect(page.getByRole('button', { name: 'Unlock Cam 1 live stream' })).toBeVisible()
  expect(mediaRequests).toEqual([])
  await page.getByRole('button', { name: 'Unlock Cam 1 live stream' }).click()

  const authDialog = page.getByRole('dialog', { name: 'Camera & device access' })
  await authDialog.getByLabel('Access password').fill(TEST_PASSWORD)
  await authDialog.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(authDialog).toHaveCount(0)
  await expect.poll(() => mediaRequests.length).toBeGreaterThan(0)
  expect(mediaRequests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBeTruthy()
})

test('keeps the live lab locked until the viewer authenticates', async ({ page }) => {
  const protectedRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/v3\/(?:camera|camera2|detections|training)/.test(request.url())) {
      protectedRequests.push(request.url())
    }
  })
  await mockPortfolioNetwork(page)
  await page.goto('/lab')

  await expect(page.getByRole('button', { name: 'Unlock Cam 1 live stream' })).toBeVisible()
  expect(protectedRequests).toEqual([])
})
