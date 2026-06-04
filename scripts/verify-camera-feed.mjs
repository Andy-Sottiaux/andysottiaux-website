#!/usr/bin/env node

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const targetUrl = process.env.CAMERA_VERIFY_URL || process.argv[2] || 'https://andysottiaux.com/?debug=1'
const expectedMode = process.env.CAMERA_VERIFY_MODE || 'hls'
const screenshotPath = process.env.CAMERA_VERIFY_SCREENSHOT ||
  path.join(process.cwd(), 'tmp', 'camera-feed-smoke.png')
const timeoutMs = Number.parseInt(process.env.CAMERA_VERIFY_TIMEOUT_MS || '45000', 10)
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

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined)

  if (expectedMode === 'rtc') {
    await page.waitForSelector(
      'iframe.cayley-go2rtc-player, video[aria-label="Cayley field camera WebRTC live preview"]',
      { timeout: timeoutMs }
    )
  } else {
    await page.waitForSelector(
      'video[aria-label="Cayley field camera WebRTC live preview"], video[aria-label="Cayley field camera clean live preview"], img[aria-label="Cayley field camera clean live preview"]',
      { timeout: timeoutMs }
    )
  }

  await page.waitForTimeout(12000)

  const state = await page.evaluate(() => {
    const iframe = document.querySelector('iframe.cayley-go2rtc-player')
    const rtcVideo = document.querySelector('video[aria-label="Cayley field camera WebRTC live preview"]')
    const hlsVideo = document.querySelector('video[aria-label="Cayley field camera clean live preview"]')
    const mjpeg = document.querySelector('img[aria-label="Cayley field camera clean live preview"]')
    const snapshot = document.querySelector('img[aria-hidden="true"]')
    const rtcStyle = rtcVideo ? getComputedStyle(rtcVideo) : null
    const videoStyle = hlsVideo ? getComputedStyle(hlsVideo) : null
    const rect = iframe?.getBoundingClientRect() || rtcVideo?.getBoundingClientRect() || hlsVideo?.getBoundingClientRect() || mjpeg?.getBoundingClientRect() || null
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
      iframe: iframe ? {
        src: iframe.getAttribute('src'),
        opacity: getComputedStyle(iframe).opacity,
      } : null,
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
      } : null,
    }
  })

  let frameState = null
  const rtcFrame = page.frames().find((frame) => frame.url().includes('cayley-relay.tailc7d6b6.ts.net/stream.html'))
  if (rtcFrame) {
    frameState = await rtcFrame.evaluate(() => {
      const player = document.querySelector('video-stream')
      const video = player?.querySelector('video') || document.querySelector('video')
      return {
        mode: document.querySelector('.mode')?.textContent || null,
        status: document.querySelector('.status')?.textContent || null,
        video: video ? {
          readyState: video.readyState,
          networkState: video.networkState,
          paused: video.paused,
          currentTime: Number(video.currentTime.toFixed(3)),
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          hasSrcObject: !!video.srcObject,
          src: video.currentSrc || video.src || '',
        } : null,
      }
    }).catch((error) => ({ error: error.message }))
  }

  await page.screenshot({ path: screenshotPath, fullPage: false })

  const blockedEvents = events.filter((event) => /ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS|local address space|blocked by CORS/i.test(event.text))
  const hlsOk = state.hlsVideo &&
    state.hlsVideo.readyState >= 2 &&
    state.hlsVideo.videoWidth >= 1280 &&
    state.hlsVideo.videoHeight >= 720 &&
    state.hlsVideo.opacity !== '0' &&
    (
      /\/api\/v3\/camera\/hls\/clean\.m3u8/.test(state.hlsVideo.src) ||
      (state.hlsVideo.src.startsWith('blob:') && state.cameraMetrics?.mode === 'hls')
    )
  const rtcOk = frameState?.mode === 'RTC' &&
    frameState.video?.readyState >= 2 &&
    frameState.video?.videoWidth >= 1280 &&
    frameState.video?.videoHeight >= 720 &&
    frameState.video?.hasSrcObject
  const embeddedRtcOk = state.rtcVideo &&
    state.rtcVideo.readyState >= 2 &&
    state.rtcVideo.videoWidth >= 1280 &&
    state.rtcVideo.videoHeight >= 720 &&
    state.rtcVideo.opacity !== '0' &&
    state.rtcVideo.hasSrcObject &&
    state.cameraMetrics?.mode === 'rtc'

  if (expectedMode === 'rtc' ? !(rtcOk || embeddedRtcOk) : !(hlsOk || embeddedRtcOk)) {
    fail(`camera_${expectedMode}_not_painting`, {
      state,
      frameState,
      blockedEvents,
      events: events.slice(-25),
      screenshotPath,
    })
  }
  if (expectedMode === 'hls' && blockedEvents.length > 0) {
    fail('camera_embed_has_private_network_blocks', {
      state,
      blockedEvents,
      events: events.slice(-25),
      screenshotPath,
    })
  }
  const hlsLatencySec = state.cameraMetrics?.hlsLatencySec
  if (
    expectedMode === 'hls' &&
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
    mode: expectedMode,
    state,
    frameState,
    events: events.slice(-10),
    screenshotPath,
  }, null, 2))
} finally {
  await browser.close()
}
