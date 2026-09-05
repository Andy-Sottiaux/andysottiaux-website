#!/usr/bin/env node

import { chromium } from 'playwright'

const targetUrl = process.env.HOME_PERF_URL || process.argv[2] || 'https://andysottiaux.com'
// Compact dashboard baseline: ~318 KiB, including public telemetry and charts.
const maxTransferKb = Number.parseInt(process.env.HOME_PERF_MAX_TRANSFER_KB || '400', 10)
const maxHealthRequests = Number.parseInt(process.env.HOME_PERF_MAX_HEALTH_REQUESTS || '1', 10)
const timeoutMs = Number.parseInt(process.env.HOME_PERF_TIMEOUT_MS || '45000', 10)

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, error: message, ...details }, null, 2))
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const requests = []
  const failures = []

  page.on('request', (req) => {
    requests.push({
      url: req.url(),
      type: req.resourceType(),
      method: req.method(),
    })
  })
  page.on('requestfailed', (req) => {
    failures.push({
      url: req.url(),
      type: req.resourceType(),
      error: req.failure()?.errorText || 'failed',
    })
  })

  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: timeoutMs })
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      duration: Math.round(entry.duration),
    }))
    return {
      navigation: nav ? {
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize,
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
      } : null,
      resources,
    }
  })

  const totalTransferBytes =
    (perf.navigation?.transferSize || 0) +
    perf.resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0)
  const totalTransferKb = Math.round(totalTransferBytes / 1024)
  const cameraIdleRequests = requests.filter((request) =>
    /\/api\/v3\/(?:camera|camera2)\//i.test(request.url)
  )
  const healthRequests = requests.filter((request) =>
    /\/api\/v3\/health(?:\?|$)/.test(request.url)
  )
  const apiRequests = requests.filter((request) => /\/api\//.test(request.url))
  const actionableFailures = failures.filter((failure) =>
    !/\/_vercel\/(?:insights|speed-insights)\/script\.js/.test(failure.url)
  )
  const largestResources = perf.resources
    .slice()
    .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
    .slice(0, 10)

  const result = {
    ok: true,
    targetUrl,
    totalTransferKb,
    maxTransferKb,
    requestCount: requests.length,
    apiRequests,
    healthRequestCount: healthRequests.length,
    maxHealthRequests,
    cameraIdleRequestCount: cameraIdleRequests.length,
    failures: actionableFailures,
    ignoredFailures: failures.length - actionableFailures.length,
    navigation: perf.navigation,
    largestResources,
  }

  if (actionableFailures.length > 0) fail('home_request_failures', result)
  if (cameraIdleRequests.length > 0) fail('home_idle_camera_requests', { ...result, cameraIdleRequests })
  if (healthRequests.length > maxHealthRequests) fail('home_duplicate_health_requests', { ...result, healthRequests })
  if (totalTransferKb > maxTransferKb) fail('home_transfer_budget_exceeded', result)

  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}
