#!/usr/bin/env node

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { activateCamera } from './lib/activate-camera.mjs'

const targetUrl = process.env.CAMERA_MONITOR_URL || process.argv[2] || 'https://andysottiaux.com/lab/dashboard?debug=1'
const durationMs = Number.parseInt(process.env.CAMERA_MONITOR_DURATION_MS || '60000', 10)
const intervalMs = Number.parseInt(process.env.CAMERA_MONITOR_INTERVAL_MS || '1000', 10)
const startupTimeoutMs = Number.parseInt(process.env.CAMERA_MONITOR_STARTUP_TIMEOUT_MS || '45000', 10)
const blockRtc = process.env.CAMERA_MONITOR_BLOCK_RTC === '1'
const screenshotPath = process.env.CAMERA_MONITOR_SCREENSHOT ||
  path.join(process.cwd(), 'tmp', 'camera-playback-monitor.png')

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function summarizeMetric(samples, key) {
  const values = samples
    .map((sample) => number(sample.cameraMetrics?.[key]))
    .filter((value) => value != null)
  if (!values.length) return null
  const sum = values.reduce((acc, value) => acc + value, 0)
  return {
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
    avg: Number((sum / values.length).toFixed(3)),
    last: Number(values[values.length - 1].toFixed(3)),
  }
}

function summarizeCounterDelta(samples, key) {
  const values = samples
    .map((sample) => number(sample.cameraMetrics?.[key]))
    .filter((value) => value != null)
  if (values.length < 2) return null
  return Number((values[values.length - 1] - values[0]).toFixed(3))
}

function summarizeVideoCounterDelta(samples, key) {
  const values = samples
    .map((sample) => number(sample.video?.[key]))
    .filter((value) => value != null)
  if (values.length < 2) return null
  return Number((values[values.length - 1] - values[0]).toFixed(3))
}

async function readSample(page, startedAt) {
  return page.evaluate((startedAt) => {
    const rtcVideo = document.querySelector('video[aria-label="Cayley field camera WebRTC live preview"]')
    const hlsVideo = document.querySelector('video[aria-label="Cayley field camera clean live preview"]')
    const cam2Video = document.querySelector('video[aria-label="HatchingPoint Cam 2 high-quality live preview"]')
    const cameraMetrics = window.__cayleyCameraMetrics || null
    const active = cam2Video || rtcVideo || hlsVideo
    const playbackQuality = active && typeof active.getVideoPlaybackQuality === 'function'
      ? active.getVideoPlaybackQuality()
      : null
    return {
      elapsedMs: Date.now() - startedAt,
      cameraMetrics,
      video: active ? {
        ariaLabel: active.getAttribute('aria-label'),
        readyState: active.readyState,
        networkState: active.networkState,
        paused: active.paused,
        currentTime: Number(active.currentTime.toFixed(3)),
        videoWidth: active.videoWidth,
        videoHeight: active.videoHeight,
        opacity: getComputedStyle(active).opacity,
        totalVideoFrames: playbackQuality?.totalVideoFrames ?? null,
        droppedVideoFrames: playbackQuality?.droppedVideoFrames ?? null,
        corruptedVideoFrames: playbackQuality?.corruptedVideoFrames ?? null,
      } : null,
    }
  }, startedAt)
}

function cameraPainted(sample) {
  return sample.video?.readyState >= 2 &&
    sample.video?.videoWidth >= 1280 &&
    sample.video?.videoHeight >= 720 &&
    sample.video?.opacity !== '0'
}

try {
  await mkdir(path.dirname(screenshotPath), { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const events = []
  if (blockRtc) {
    await page.route('**/api/v3/camera/webrtc/offer**', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'text/plain',
        body: 'rtc blocked by camera monitor',
      })
    })
  }
  page.on('console', (msg) => {
    const text = msg.text()
    if (/error|warn|local address space|blocked|hls|video|webrtc|rtc|camera/i.test(text)) {
      events.push({ type: msg.type(), text: text.slice(0, 500) })
    }
  })
  page.on('requestfailed', (req) => {
    const url = req.url()
    if (/cayley|camera|m3u8|\.ts|video|api\/ws/.test(url)) {
      events.push({
        type: 'requestfailed',
        text: `${req.failure()?.errorText || 'failed'} ${url}`.slice(0, 500),
      })
    }
  })

  const startedAt = Date.now()
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs })
  await activateCamera(page, 'Cam 1')

  let firstPaintMs = null
  while (Date.now() - startedAt < startupTimeoutMs) {
    const sample = await readSample(page, startedAt)
    if (cameraPainted(sample)) {
      firstPaintMs = sample.elapsedMs
      break
    }
    await page.waitForTimeout(500)
  }

  const samples = []
  const sampleUntil = Date.now() + durationMs
  while (Date.now() < sampleUntil) {
    samples.push(await readSample(page, startedAt))
    await page.waitForTimeout(intervalMs)
  }
  await page.screenshot({ path: screenshotPath, fullPage: false })

  const steadySamples = firstPaintMs == null
    ? []
    : samples.filter((sample) => sample.elapsedMs >= firstPaintMs)
  const blankAfterFirstPaintSamples = steadySamples.filter((sample) => !cameraPainted(sample))
  const first = samples[0] || null
  const last = samples[samples.length - 1] || null
  const videoTimeDeltaSec = first?.video && last?.video
    ? Number((last.video.currentTime - first.video.currentTime).toFixed(3))
    : null
  const wallTimeDeltaSec = first && last
    ? Number(((last.elapsedMs - first.elapsedMs) / 1000).toFixed(3))
    : null
  const droppedFramesDelta = summarizeCounterDelta(samples, 'rtcFramesDropped')
  const decodedFramesDelta = summarizeCounterDelta(samples, 'rtcFramesDecoded')
  const videoTotalFramesDelta = summarizeVideoCounterDelta(samples, 'totalVideoFrames')
  const videoDroppedFramesDelta = summarizeVideoCounterDelta(samples, 'droppedVideoFrames')
  const videoCorruptedFramesDelta = summarizeVideoCounterDelta(samples, 'corruptedVideoFrames')

  const summary = {
    ok: firstPaintMs != null &&
      steadySamples.length > 0 &&
      blankAfterFirstPaintSamples.length === 0,
    url: targetUrl,
    blockRtc,
    durationMs,
    intervalMs,
    sampleCount: samples.length,
    firstPaintMs,
    steadySampleCount: steadySamples.length,
    blankAfterFirstPaintCount: blankAfterFirstPaintSamples.length,
    mode: last?.cameraMetrics?.mode || null,
    videoWidth: last?.video?.videoWidth || null,
    videoHeight: last?.video?.videoHeight || null,
    videoTimeDeltaSec,
    wallTimeDeltaSec,
    videoProgressRatio: videoTimeDeltaSec != null && wallTimeDeltaSec
      ? Number((videoTimeDeltaSec / wallTimeDeltaSec).toFixed(3))
      : null,
    rtcFramesPerSecond: summarizeMetric(samples, 'rtcFramesPerSecond'),
    rtcFramesDecodedDelta: decodedFramesDelta,
    rtcFramesDroppedDelta: droppedFramesDelta,
    rtcDropRatio: decodedFramesDelta != null && decodedFramesDelta > 0 && droppedFramesDelta != null
      ? Number((droppedFramesDelta / decodedFramesDelta).toFixed(6))
      : null,
    rtcPacketsReceivedDelta: summarizeCounterDelta(samples, 'rtcPacketsReceived'),
    rtcDegradedReason: last?.cameraMetrics?.rtcDegradedReason || null,
    videoTotalFramesDelta,
    videoDroppedFramesDelta,
    videoCorruptedFramesDelta,
    videoDropRatio: videoTotalFramesDelta != null && videoTotalFramesDelta > 0 && videoDroppedFramesDelta != null
      ? Number((videoDroppedFramesDelta / videoTotalFramesDelta).toFixed(6))
      : null,
    rtcCurrentRoundTripTimeSec: summarizeMetric(samples, 'rtcCurrentRoundTripTimeSec'),
    rtcJitterSec: summarizeMetric(samples, 'rtcJitterSec'),
    rtcPacketsLostDelta: summarizeCounterDelta(samples, 'rtcPacketsLost'),
    rtcAvailableIncomingBitrate: summarizeMetric(samples, 'rtcAvailableIncomingBitrate'),
    hlsLatencySec: summarizeMetric(samples, 'hlsLatencySec'),
    lastSample: last,
    events: events.slice(-20),
    screenshotPath,
  }

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exit(1)
} finally {
  await browser.close()
}
