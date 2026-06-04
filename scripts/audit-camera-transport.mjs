#!/usr/bin/env node

import { chromium } from 'playwright'

const baseUrl = process.env.CAMERA_TRANSPORT_AUDIT_URL || 'https://andysottiaux.com'
const stream = process.env.CAMERA_TRANSPORT_STREAM || 'cayley-sub'
const timeoutMs = Number.parseInt(process.env.CAMERA_TRANSPORT_TIMEOUT_MS || '45000', 10)
const iceGatherTimeoutMs = Number.parseInt(process.env.CAMERA_TRANSPORT_ICE_GATHER_TIMEOUT_MS || '2500', 10)

function classifyIp(address) {
  if (!address) return 'unknown'
  if (/^[a-z0-9.-]+$/i.test(address) && /[a-z]/i.test(address)) return 'hostname'

  const v4 = address.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const octets = v4.slice(1).map(Number)
    const [a, b] = octets
    if (a === 10) return 'private-rfc1918'
    if (a === 172 && b >= 16 && b <= 31) return 'private-rfc1918'
    if (a === 192 && b === 168) return 'private-rfc1918'
    if (a === 100 && b >= 64 && b <= 127) return 'tailnet-cgnat'
    if (a === 127) return 'loopback'
    if (a === 169 && b === 254) return 'link-local'
    return 'public-ipv4'
  }

  const lower = address.toLowerCase()
  if (lower === '::1') return 'loopback'
  if (lower.startsWith('fe80:')) return 'link-local'
  if (lower.startsWith('fc') || lower.startsWith('fd')) return 'private-ula'
  if (lower.includes(':')) return 'public-ipv6'
  return 'unknown'
}

function parseCandidates(sdp) {
  return sdp
    .split(/\r?\n/)
    .filter((line) => line.startsWith('a=candidate:'))
    .map((line) => {
      const parts = line.slice('a=candidate:'.length).trim().split(/\s+/)
      const typIndex = parts.indexOf('typ')
      const candidate = {
        line,
        foundation: parts[0] || null,
        component: parts[1] || null,
        protocol: parts[2]?.toLowerCase() || null,
        priority: parts[3] ? Number(parts[3]) : null,
        address: parts[4] || null,
        port: parts[5] ? Number(parts[5]) : null,
        type: typIndex >= 0 ? parts[typIndex + 1] || null : null,
      }
      return {
        ...candidate,
        reachability: classifyIp(candidate.address),
      }
    })
}

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})

try {
  const page = await browser.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  const result = await page.evaluate(
    async ({ stream, timeoutMs, iceGatherTimeoutMs }) => {
      const startedAt = performance.now()
      const pc = new RTCPeerConnection({
        bundlePolicy: 'max-bundle',
        iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }],
      })
      const localCandidates = []
      pc.addEventListener('icecandidate', (event) => {
        if (event.candidate?.candidate) localCandidates.push(event.candidate.candidate)
      })
      pc.addTransceiver('video', { direction: 'recvonly' })
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve()
        let done = false
        const finish = () => {
          if (done) return
          done = true
          resolve()
        }
        const timer = setTimeout(finish, iceGatherTimeoutMs)
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timer)
            finish()
          }
        })
      })
      const offerSdp = pc.localDescription?.sdp || ''
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const res = await fetch(`/api/v3/camera/webrtc/offer?stream=${encodeURIComponent(stream)}`, {
          method: 'POST',
          cache: 'no-store',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/sdp' },
          body: offerSdp,
        })
        const answerSdp = await res.text()
        return {
          ok: res.ok,
          status: res.status,
          elapsedMs: Math.round(performance.now() - startedAt),
          localIceGatheringState: pc.iceGatheringState,
          localCandidateLines: localCandidates,
          answerSdp,
          answerPreview: answerSdp.slice(0, 1200),
        }
      } finally {
        clearTimeout(timer)
        pc.close()
      }
    },
    { stream, timeoutMs, iceGatherTimeoutMs }
  )

  const candidates = parseCandidates(result.answerSdp || '')
  const turnRelayCandidates = candidates.filter((candidate) => candidate.type === 'relay')
  const publicHostCandidates = candidates.filter((candidate) =>
    candidate.type === 'host' &&
    (candidate.reachability === 'public-ipv4' || candidate.reachability === 'public-ipv6')
  )
  const publicServerReflexiveCandidates = candidates.filter((candidate) =>
    candidate.type === 'srflx' &&
    (candidate.reachability === 'public-ipv4' || candidate.reachability === 'public-ipv6')
  )
  const publicMediaCandidates = [
    ...turnRelayCandidates,
    ...publicHostCandidates,
    ...publicServerReflexiveCandidates,
  ]
  const tailnetOrLanCandidates = candidates.filter((candidate) =>
    ['private-rfc1918', 'tailnet-cgnat', 'private-ula', 'link-local'].includes(candidate.reachability)
  )
  const summary = {
    ok: result.ok,
    url: baseUrl,
    stream,
    status: result.status,
    elapsedMs: result.elapsedMs,
    candidateCount: candidates.length,
    publicMediaCandidateCount: publicMediaCandidates.length,
    turnRelayCandidateCount: turnRelayCandidates.length,
    publicHostCandidateCount: publicHostCandidates.length,
    publicServerReflexiveCandidateCount: publicServerReflexiveCandidates.length,
    tailnetOrLanCandidateCount: tailnetOrLanCandidates.length,
    robustPublicRtcReachable: turnRelayCandidates.length > 0 || publicHostCandidates.length > 0,
    potentialPublicRtcReachable: publicServerReflexiveCandidates.length > 0,
    likelyTailnetOrLanOnly: publicMediaCandidates.length === 0 && tailnetOrLanCandidates.length > 0,
  }

  console.log(JSON.stringify({
    ...summary,
    candidates,
    recommendation: summary.robustPublicRtcReachable
      ? 'RTC has a TURN relay or public host candidate.'
      : summary.potentialPublicRtcReachable
        ? 'RTC has public STUN server-reflexive candidates; public viewers may connect directly, but off-tailnet browser verification is still required.'
      : 'RTC is currently LAN/tailnet candidate only; arbitrary public viewers should expect HLS fallback unless a TURN/public media relay is added.',
  }, null, 2))

  if (!result.ok) process.exit(1)
} finally {
  await browser.close()
}
