#!/usr/bin/env node

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { activateCamera } from './lib/activate-camera.mjs'

const targetUrl = process.env.CAMERA_VERIFY_URL || process.argv[2] || 'https://andysottiaux.com/lab/dashboard?debug=1'
const expectedMode = process.env.CAMERA_VERIFY_MODE || 'any'
const screenshotPath = process.env.CAMERA_VERIFY_SCREENSHOT ||
  path.join(process.cwd(), 'tmp', 'camera-feed-smoke.png')
const timeoutMs = Number.parseInt(process.env.CAMERA_VERIFY_TIMEOUT_MS || '45000', 10)
const settleMs = Number.parseInt(process.env.CAMERA_VERIFY_SETTLE_MS || '12000', 10)
const maxHlsLatencySec = Number.parseFloat(process.env.CAMERA_VERIFY_MAX_HLS_LATENCY_SEC || '4.5')

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, error: message, ...details }, null, 2))
  process.exit(1)
}

function compactEvent(event) {
  return {
    type: event.type,
    text: event.text.slice(0, 500),
  }
}

function evaluateCameraState(state) {
  const hlsOk = state.hlsVideo &&
    state.hlsVideo.readyState >= 2 &&
    state.hlsVideo.videoWidth >= 1280 &&
    state.hlsVideo.videoHeight >= 720 &&
    state.hlsVideo.opacity !== '0' &&
    (
      /\/api\/v3\/camera\/hls\/clean\.m3u8/.test(state.hlsVideo.src) ||
      (state.hlsVideo.src.startsWith('blob:') && state.cameraMetrics?.mode === 'hls')
    )
  const embeddedRtcOk = state.rtcVideo &&
    state.rtcVideo.readyState >= 2 &&
    state.rtcVideo.videoWidth >= 1280 &&
    state.rtcVideo.videoHeight >= 720 &&
    state.rtcVideo.opacity !== '0' &&
    state.rtcVideo.hasSrcObject &&
    state.cameraMetrics?.mode === 'rtc' &&
    !state.cameraMetrics?.rtcDegradedReason

  return {
    hlsOk: Boolean(hlsOk),
    embeddedRtcOk: Boolean(embeddedRtcOk),
    expectedOk: expectedMode === 'rtc'
      ? Boolean(embeddedRtcOk)
      : expectedMode === 'hls'
        ? Boolean(hlsOk)
        : Boolean(hlsOk || embeddedRtcOk),
  }
}

async function readCameraState(page) {
  const state = await page.evaluate(() => {
    const rtcVideo = document.querySelector('video[aria-label="Cayley field camera WebRTC live preview"]')
    const hlsVideo = document.querySelector('video[aria-label="Cayley field camera clean live preview"]')
    const mjpeg = document.querySelector('img[aria-label="Cayley field camera clean live preview"]')
    const snapshot = document.querySelector('img[aria-hidden="true"]')
    const rtcStyle = rtcVideo ? getComputedStyle(rtcVideo) : null
    const videoStyle = hlsVideo ? getComputedStyle(hlsVideo) : null
    const rect = rtcVideo?.getBoundingClientRect() || hlsVideo?.getBoundingClientRect() || mjpeg?.getBoundingClientRect() || null
    const timeRanges = (ranges) => Array.from(
      { length: ranges?.length || 0 },
      (_, i) => [Number(ranges.start(i).toFixed(3)), Number(ranges.end(i).toFixed(3))]
    )
    const buffered = hlsVideo ? timeRanges(hlsVideo.buffered) : []
    const bufferedEnd = buffered.length ? buffered[buffered.length - 1][1] : null
    const seekable = hlsVideo ? timeRanges(hlsVideo.seekable) : []
    const seekableEnd = seekable.length ? seekable[seekable.length - 1][1] : null
    const cameraMetrics = window.__cayleyCameraMetrics || null

    return {
      url: location.href,
      cameraTextVisible: /CAMERA/.test(document.body.innerText),
      liveTextVisible: /LIVE/.test(document.body.innerText),
      rtcVideo: rtcVideo ? {
        readyState: rtcVideo.readyState,
        networkState: rtcVideo.networkState,
        paused: rtcVideo.paused,
        currentTime: Number(rtcVideo.currentTime.toFixed(3)),
        videoWidth: rtcVideo.videoWidth,
        videoHeight: rtcVideo.videoHeight,
        playbackRate: Number(rtcVideo.playbackRate.toFixed(3)),
        hasSrcObject: !!rtcVideo.srcObject,
        src: rtcVideo.currentSrc || rtcVideo.src || '',
        opacity: rtcStyle?.opacity || null,
      } : null,
      hlsVideo: hlsVideo ? {
        readyState: hlsVideo.readyState,
        networkState: hlsVideo.networkState,
        paused: hlsVideo.paused,
        currentTime: Number(hlsVideo.currentTime.toFixed(3)),
        buffered,
        bufferedAheadSec: typeof bufferedEnd === 'number'
          ? Number(Math.max(0, bufferedEnd - hlsVideo.currentTime).toFixed(3))
          : null,
        seekable,
        liveDriftSec: typeof seekableEnd === 'number'
          ? Number(Math.max(0, seekableEnd - hlsVideo.currentTime).toFixed(3))
          : null,
        videoWidth: hlsVideo.videoWidth,
        videoHeight: hlsVideo.videoHeight,
        playbackRate: Number(hlsVideo.playbackRate.toFixed(3)),
        src: hlsVideo.currentSrc || hlsVideo.src || '',
        opacity: videoStyle?.opacity || null,
      } : null,
      cameraMetrics,
      mjpegFallback: !!mjpeg,
      snapshotLoaded: snapshot instanceof HTMLImageElement ? snapshot.complete && snapshot.naturalWidth > 0 : null,
      rect: rect ? {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } : null
    }
  })

  return state
}

await mkdir(path.dirname(screenshotPath), { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const events = []

  page.on('console', (msg) => {
    const text = msg.text()
    if (/error|warn|local address space|blocked|hls|video|webrtc|rtc|camera/i.test(text)) {
      events.push(compactEvent({ type: msg.type(), text }))
    }
  })
  page.on('requestfailed', (req) => {
    const url = req.url()
    if (/cayley|camera|m3u8|\.ts|video|api\/ws/.test(url)) {
      events.push(compactEvent({
        type: 'requestfailed',
        text: `${req.failure()?.errorText || 'failed'} ${url}`,
      }))
    }
  })

  const startedAt = Date.now()
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  await activateCamera(page, 'Cam 1')
  const timings = {
    domContentLoadedMs: Date.now() - startedAt,
    snapshotLoadedMs: null,
    hlsPaintedMs: null,
    rtcPaintedMs: null,
    expectedPaintedMs: null,
  }
  let state = null
  let checks = { hlsOk: false, embeddedRtcOk: false, expectedOk: false }
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    state = await readCameraState(page)
    checks = evaluateCameraState(state)
    const elapsedMs = Date.now() - startedAt

    if (state.snapshotLoaded && timings.snapshotLoadedMs === null) timings.snapshotLoadedMs = elapsedMs
    if (checks.hlsOk && timings.hlsPaintedMs === null) timings.hlsPaintedMs = elapsedMs
    if (checks.embeddedRtcOk && timings.rtcPaintedMs === null) timings.rtcPaintedMs = elapsedMs
    if (checks.expectedOk) {
      timings.expectedPaintedMs = timings.expectedPaintedMs ?? elapsedMs
      break
    }

    await page.waitForTimeout(750)
  }

  if (settleMs > 0 && checks.expectedOk) {
    await page.waitForTimeout(settleMs)
    state = await readCameraState(page)
    checks = evaluateCameraState(state)
  }

  await page.screenshot({ path: screenshotPath, fullPage: false })

  const blockedEvents = events.filter((event) => /ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS|local address space|blocked by CORS/i.test(event.text))

  if (!checks.expectedOk) {
    fail(`camera_${expectedMode}_not_painting`, {
      timings,
      checks,
      state,
      blockedEvents,
      events: events.slice(-25),
      screenshotPath,
    })
  }
  if (expectedMode !== 'rtc' && blockedEvents.length > 0) {
    fail('camera_embed_has_private_network_blocks', {
      state,
      blockedEvents,
      events: events.slice(-25),
      screenshotPath,
    })
  }
  const hlsLatencySec = state.cameraMetrics?.hlsLatencySec
  if (
    expectedMode !== 'rtc' &&
    state.cameraMetrics?.mode === 'hls' &&
    Number.isFinite(maxHlsLatencySec) &&
    maxHlsLatencySec > 0 &&
    typeof hlsLatencySec === 'number' &&
    hlsLatencySec > maxHlsLatencySec
  ) {
    fail('camera_hls_latency_too_high', {
      maxHlsLatencySec,
      state,
      events: events.slice(-25),
      screenshotPath,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    mode: state.cameraMetrics?.mode || (checks.embeddedRtcOk ? 'rtc' : checks.hlsOk ? 'hls' : expectedMode),
    expectedMode,
    timings,
    checks,
    state,
    events: events.slice(-10),
    screenshotPath,
  }, null, 2))
} finally {
  await browser.close()
}
