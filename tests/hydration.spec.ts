import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer, type Server } from 'node:http'
import { expect, test } from '@playwright/test'
import { mockPortfolioNetwork } from './support/mockPortfolioNetwork'

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture did not bind a local port')
  return address.port
}

test('seeded health hydrates after delayed JavaScript and advances its source age', async ({ page }) => {
  test.setTimeout(60_000)
  const observedAt = Date.now() - 8_000
  const healthFixture = {
    ok: true,
    uptime_s: 172800,
    service_count: 2,
    telemetry: { observed_at: observedAt, received_at: observedAt + 8_000, age_seconds: 8, stale: false },
    services: [{ name: 'camera', status: 'running', ok: true }, { name: 'rknn', status: 'running', ok: true }],
    services_down: [],
    system: { cpu_temp_c: 48 },
  }
  const upstream = createServer((request, response) => {
    response.writeHead(request.url === '/api/health' ? 200 : 404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(healthFixture))
  })
  const upstreamPort = await listen(upstream)
  const reservation = createServer()
  const dashboardPort = await listen(reservation)
  await new Promise<void>(resolve => reservation.close(() => resolve()))
  const origin = `http://127.0.0.1:${dashboardPort}`
  const dashboard = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(dashboardPort)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', V3_HEALTH_UPSTREAM_HOST: `http://127.0.0.1:${upstreamPort}` },
    stdio: 'ignore',
  })
  let releaseBundles = () => {}
  try {
    await expect.poll(async () => {
      if (dashboard.exitCode !== null) throw new Error('The seeded production server exited before startup')
      try { return (await fetch(origin, { signal: AbortSignal.timeout(1_000) })).status } catch { return 0 }
    }, { timeout: 30_000 }).toBe(200)
    await mockPortfolioNetwork(page)
    await page.route('**/api/v3/health', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(healthFixture) }))
    const bundleGate = new Promise<void>(resolve => { releaseBundles = resolve })
    let delayedBundles = 0
    await page.route('**/_next/static/**/*.js', async route => {
      delayedBundles += 1
      await bundleGate
      await route.continue()
    })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin, { waitUntil: 'commit' })
    const health = page.getByLabel('System health', { exact: true })
    await expect(health).toContainText('Hardware online')
    await expect(health).toContainText(/sample \d+s ago/)
    const initialAge = Number((await health.innerText()).match(/sample (\d+)s ago/)?.[1])
    expect(Number.isFinite(initialAge)).toBe(true)
    await expect.poll(() => delayedBundles).toBeGreaterThan(0)
    // This is the slow initial-download condition that previously changed the
    // server-rendered age before React could hydrate it.
    await page.waitForTimeout(2_000)
    releaseBundles()
    await page.waitForLoadState('networkidle')
    await expect.poll(async () => Number((await health.innerText()).match(/sample (\d+)s ago/)?.[1])).toBeGreaterThanOrEqual(initialAge + 2)
    await expect(health).toContainText('Hardware online')
    expect(errors).toEqual([])
  } finally {
    releaseBundles()
    await page.unrouteAll({ behavior: 'wait' })
    const exited = once(dashboard, 'exit')
    dashboard.kill('SIGTERM')
    await Promise.race([exited, new Promise<void>(resolve => setTimeout(() => { dashboard.kill('SIGKILL'); resolve() }, 3_000))])
    upstream.closeAllConnections()
    await new Promise<void>(resolve => upstream.close(() => resolve()))
  }
})
