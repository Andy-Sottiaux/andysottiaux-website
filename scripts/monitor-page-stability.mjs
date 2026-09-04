#!/usr/bin/env node

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { activateCamera } from './lib/activate-camera.mjs'

const targetUrl = process.env.PAGE_STABILITY_URL || process.argv[2] || 'https://andysottiaux.com/lab/dashboard?debug=1'
const durationMs = Number.parseInt(process.env.PAGE_STABILITY_DURATION_MS || '30000', 10)
const intervalMs = Number.parseInt(process.env.PAGE_STABILITY_INTERVAL_MS || '500', 10)
const startupTimeoutMs = Number.parseInt(process.env.PAGE_STABILITY_STARTUP_TIMEOUT_MS || '45000', 10)
const screenshotPath = process.env.PAGE_STABILITY_SCREENSHOT ||
  path.join(process.cwd(), 'tmp', 'page-stability-monitor.png')

function changedCount(samples, read) {
  let count = 0
  let previous = null
  for (const sample of samples) {
    const next = JSON.stringify(read(sample))
    if (previous != null && next !== previous) count += 1
    previous = next
  }
  return count
}

function summarizeNumber(samples, read) {
  const values = samples
    .map(read)
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (!values.length) return null
  const sum = values.reduce((acc, value) => acc + value, 0)
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Number((sum / values.length).toFixed(3)),
    last: values[values.length - 1],
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})

try {
  await mkdir(path.dirname(screenshotPath), { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const events = []

  page.on('console', (msg) => {
    const text = msg.text()
    if (/error|warn|hls|video|webrtc|rtc|camera/i.test(text)) {
      events.push({ type: msg.type(), text: text.slice(0, 500) })
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      events.push({
        type: 'response',
        text: `${response.status()} ${response.url()}`.slice(0, 500),
      })
    }
  })

  await page.addInitScript(() => {
    window.__pageStability = {
      addedNodes: 0,
      removedNodes: 0,
      classOrStyleMutations: 0,
      lastMutationAt: 0,
    }
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        window.__pageStability.lastMutationAt = Date.now()
        window.__pageStability.addedNodes += mutation.addedNodes.length
        window.__pageStability.removedNodes += mutation.removedNodes.length
        if (
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'class' || mutation.attributeName === 'style')
        ) {
          window.__pageStability.classOrStyleMutations += 1
        }
      }
    })
    window.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style'],
        })
      }
    }, { once: true })
  })

  const startedAt = Date.now()
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs })
  await activateCamera(page, 'Cam 1')

  const samples = []
  const deadline = Date.now() + durationMs
  while (Date.now() < deadline) {
    samples.push(await page.evaluate((startedAt) => {
      const shell = document.querySelector('.bento-shell')
      const cameraRoot = document.querySelector('[aria-label="Cayley field camera WebRTC live preview"]')?.parentElement ||
        document.querySelector('[aria-label="Cayley field camera clean live preview"]')?.parentElement ||
        null
      const media = Array.from(document.querySelectorAll('video, img[aria-label*="live preview"]'))
        .map((node) => {
          const el = node
          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return {
            tag: el.tagName.toLowerCase(),
            aria: el.getAttribute('aria-label') || '',
            opacity: style.opacity,
            display: style.display,
            visibility: style.visibility,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            readyState: el instanceof HTMLVideoElement ? el.readyState : null,
            videoWidth: el instanceof HTMLVideoElement ? el.videoWidth : null,
            videoHeight: el instanceof HTMLVideoElement ? el.videoHeight : null,
            currentTime: el instanceof HTMLVideoElement ? Number(el.currentTime.toFixed(3)) : null,
            hasSrcObject: el instanceof HTMLVideoElement ? Boolean(el.srcObject) : null,
          }
        })
      const visibleMedia = media.filter((item) => (
        item.display !== 'none' &&
        item.visibility !== 'hidden' &&
        item.opacity !== '0' &&
        item.width > 0 &&
        item.height > 0
      ))
      const animated = Array.from(document.querySelectorAll('body *'))
        .filter((node) => {
          const style = window.getComputedStyle(node)
          return style.animationName !== 'none' &&
            style.animationDuration !== '0s' &&
            style.animationDuration !== '0.001ms' &&
            style.animationDuration !== '1e-06s'
        })
        .slice(0, 12)
        .map((node) => {
          const style = window.getComputedStyle(node)
          return {
            tag: node.tagName.toLowerCase(),
            text: (node.textContent || '').trim().slice(0, 80),
            animationName: style.animationName,
            animationDuration: style.animationDuration,
          }
        })
      const stability = window.__pageStability || {}
      return {
        elapsedMs: Date.now() - startedAt,
        cameraPerformanceMode: shell?.getAttribute('data-camera-performance') || null,
        cameraText: cameraRoot?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 400) || '',
        media,
        visibleMedia,
        visibleMediaCount: visibleMedia.length,
        animatedCount: animated.length,
        animated,
        mutations: {
          addedNodes: stability.addedNodes || 0,
          removedNodes: stability.removedNodes || 0,
          classOrStyleMutations: stability.classOrStyleMutations || 0,
          lastMutationAgeMs: stability.lastMutationAt ? Date.now() - stability.lastMutationAt : null,
        },
      }
    }, startedAt))
    await page.waitForTimeout(intervalMs)
  }

  await page.screenshot({ path: screenshotPath, fullPage: false })

  const first = samples[0] || null
  const last = samples[samples.length - 1] || null
  const firstVisibleIndex = samples.findIndex((sample) => sample.visibleMediaCount > 0)
  const steadySamples = firstVisibleIndex >= 0 ? samples.slice(firstVisibleIndex) : []
  const firstSteady = steadySamples[0] || null
  const lastSteady = steadySamples[steadySamples.length - 1] || null
  const summary = {
    ok: Boolean(last?.cameraPerformanceMode === 'true' && last?.animatedCount === 0),
    url: targetUrl,
    durationMs,
    intervalMs,
    sampleCount: samples.length,
    cameraPerformanceMode: last?.cameraPerformanceMode || null,
    animatedCount: summarizeNumber(samples, (sample) => sample.animatedCount),
    visibleMediaCount: summarizeNumber(samples, (sample) => sample.visibleMediaCount),
    visibleMediaShapeChanges: changedCount(samples, (sample) => sample.visibleMedia.map((item) => ({
      tag: item.tag,
      aria: item.aria,
      opacity: item.opacity,
      readyState: item.readyState,
      videoWidth: item.videoWidth,
      videoHeight: item.videoHeight,
      hasSrcObject: item.hasSrcObject,
    }))),
    steadySampleCount: steadySamples.length,
    steadyVisibleMediaShapeChanges: changedCount(steadySamples, (sample) => sample.visibleMedia.map((item) => ({
      tag: item.tag,
      aria: item.aria,
      opacity: item.opacity,
      readyState: item.readyState,
      videoWidth: item.videoWidth,
      videoHeight: item.videoHeight,
      hasSrcObject: item.hasSrcObject,
    }))),
    cameraTextChanges: changedCount(samples, (sample) => sample.cameraText),
    steadyCameraTextChanges: changedCount(steadySamples, (sample) => sample.cameraText),
    mutationsDelta: first && last
      ? {
          addedNodes: last.mutations.addedNodes - first.mutations.addedNodes,
          removedNodes: last.mutations.removedNodes - first.mutations.removedNodes,
          classOrStyleMutations: last.mutations.classOrStyleMutations - first.mutations.classOrStyleMutations,
        }
      : null,
    steadyMutationsDelta: firstSteady && lastSteady
      ? {
          addedNodes: lastSteady.mutations.addedNodes - firstSteady.mutations.addedNodes,
          removedNodes: lastSteady.mutations.removedNodes - firstSteady.mutations.removedNodes,
          classOrStyleMutations: lastSteady.mutations.classOrStyleMutations - firstSteady.mutations.classOrStyleMutations,
        }
      : null,
    lastVisibleMedia: last?.visibleMedia || [],
    lastAnimated: last?.animated || [],
    events: events.slice(-20),
    screenshotPath,
  }

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exit(1)
} finally {
  await browser.close()
}
