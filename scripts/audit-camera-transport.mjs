#!/usr/bin/env node

import { chromium } from 'playwright'

const baseUrl = process.env.CAMERA_TRANSPORT_AUDIT_URL || 'https://andysottiaux.com'
const stream = process.env.CAMERA_TRANSPORT_STREAM || 'cayley-sub'
const offerUrl = process.env.CAMERA_TRANSPORT_OFFER_URL || '/api/v3/camera/webrtc/offer'
const sourceParam = process.env.CAMERA_TRANSPORT_SOURCE_PARAM || 'stream'
const timeoutMs = Number.parseInt(process.env.CAMERA_TRANSPORT_TIMEOUT_MS || '45000', 10)
const iceGatherTimeoutMs = Number.parseInt(process.env.CAMERA_TRANSPORT_ICE_GATHER_TIMEOUT_MS || '2500', 10)
const connectTimeoutMs = Number.parseInt(process.env.CAMERA_TRANSPORT_CONNECT_TIMEOUT_MS || '9000', 10)
const browserChannel = process.env.CAMERA_TRANSPORT_BROWSER_CHANNEL || ''
const requireMediaConnected = process.env.CAMERA_TRANSPORT_REQUIRE_CONNECTED === '1'
const accessPassword = process.env.CAMERA_ACCESS_PASSWORD || ''

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
  ...(browserChannel ? { channel: browserChannel } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
})

try {
  const page = await browser.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  if (!accessPassword) {
    throw new Error('CAMERA_ACCESS_PASSWORD is required for private camera transport auditing')
  }
  const authResponse = await page.request.post(new URL('/api/v3/control-auth', baseUrl).toString(), {
    data: { password: accessPassword },
  })
  if (!authResponse.ok()) {
    throw new Error(`camera access authentication failed (${authResponse.status()})`)
  }
  const result = await page.evaluate(
    async ({ stream, offerUrl, sourceParam, timeoutMs, iceGatherTimeoutMs, connectTimeoutMs }) => {
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
      const offeredVideoCodecs = Array.from(
        new Set(
          offerSdp
            .split(/\r?\n/)
            .map((line) => line.match(/^a=rtpmap:\d+\s+([^/]+)/i)?.[1]?.toUpperCase())
            .filter(Boolean)
        )
      )
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const url = new URL(offerUrl, window.location.href)
        url.searchParams.set(sourceParam, stream)
        const res = await fetch(url.toString(), {
          method: 'POST',
          cache: 'no-store',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/sdp' },
          body: offerSdp,
        })
        const answerSdp = await res.text()
        if (res.ok) {
          await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
          await new Promise((resolve) => {
            if (
              pc.connectionState === 'connected' ||
              pc.iceConnectionState === 'connected' ||
              pc.iceConnectionState === 'completed'
            ) {
              return resolve()
            }
            let done = false
            const finish = () => {
              if (done) return
              done = true
              resolve()
            }
            const connectionTimer = setTimeout(finish, connectTimeoutMs)
            const onState = () => {
              if (
                pc.connectionState === 'connected' ||
                pc.iceConnectionState === 'connected' ||
                pc.iceConnectionState === 'completed' ||
                pc.connectionState === 'failed' ||
                pc.iceConnectionState === 'failed'
              ) {
                clearTimeout(connectionTimer)
                finish()
              }
            }
            pc.addEventListener('connectionstatechange', onState)
            pc.addEventListener('iceconnectionstatechange', onState)
          })
        }

        const report = await pc.getStats()
        let selectedPair = null
        let selectedPairId = null
        report.forEach((raw) => {
          const stat = raw
          if (stat.type === 'transport' && stat.selectedCandidatePairId) {
            selectedPairId = stat.selectedCandidatePairId
          }
        })
        report.forEach((raw) => {
          const stat = raw
          if (
            stat.type === 'candidate-pair' &&
            (stat.id === selectedPairId || stat.selected === true || (stat.nominated === true && stat.state === 'succeeded'))
          ) {
            const local = report.get(stat.localCandidateId)
            const remote = report.get(stat.remoteCandidateId)
            const slimCandidate = (candidate) => candidate ? {
              address: candidate.address || candidate.ip || null,
              port: candidate.port || null,
              protocol: candidate.protocol || null,
              candidateType: candidate.candidateType || null,
              relayProtocol: candidate.relayProtocol || null,
            } : null
            selectedPair = {
              id: stat.id,
              state: stat.state || null,
              nominated: stat.nominated ?? null,
              currentRoundTripTime: stat.currentRoundTripTime ?? null,
              availableIncomingBitrate: stat.availableIncomingBitrate ?? null,
              bytesReceived: stat.bytesReceived ?? null,
              packetsReceived: stat.packetsReceived ?? null,
              packetsDiscardedOnSend: stat.packetsDiscardedOnSend ?? null,
              localCandidate: slimCandidate(local),
              remoteCandidate: slimCandidate(remote),
            }
          }
        })

        return {
          ok: res.ok,
          status: res.status,
          elapsedMs: Math.round(performance.now() - startedAt),
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          localIceGatheringState: pc.iceGatheringState,
          localCandidateLines: localCandidates,
          offeredVideoCodecs,
          selectedPair,
          answerSdp,
          answerPreview: answerSdp.slice(0, 1200),
        }
      } finally {
        clearTimeout(timer)
        pc.close()
      }
    },
    { stream, offerUrl, sourceParam, timeoutMs, iceGatherTimeoutMs, connectTimeoutMs }
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
    offerOk: result.ok,
    url: baseUrl,
    stream,
    offerUrl,
    sourceParam,
    browserChannel: browserChannel || 'chromium',
    status: result.status,
    elapsedMs: result.elapsedMs,
    responsePreview: result.answerPreview || null,
    offeredVideoCodecs: result.offeredVideoCodecs || [],
    connectionState: result.connectionState,
    iceConnectionState: result.iceConnectionState,
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
  const selectedRemoteReachability = result.selectedPair?.remoteCandidate
    ? classifyIp(result.selectedPair.remoteCandidate.address)
    : null
  const mediaConnected =
    result.connectionState === 'connected' ||
    result.iceConnectionState === 'connected' ||
    result.iceConnectionState === 'completed'
  const selectedPublicMedia =
    result.selectedPair?.remoteCandidate?.candidateType === 'relay' ||
    selectedRemoteReachability === 'public-ipv4' ||
    selectedRemoteReachability === 'public-ipv6'
  const selectedTailnetOrLan =
    selectedRemoteReachability &&
    ['private-rfc1918', 'tailnet-cgnat', 'private-ula', 'link-local'].includes(selectedRemoteReachability)

  console.log(JSON.stringify({
    ...summary,
    ok: result.ok && (!requireMediaConnected || mediaConnected),
    mediaConnected,
    selectedRemoteReachability,
    selectedPublicMedia,
    selectedTailnetOrLan,
    requireMediaConnected,
    selectedPair: result.selectedPair ? {
      ...result.selectedPair,
      localCandidate: result.selectedPair.localCandidate ? {
        ...result.selectedPair.localCandidate,
        reachability: classifyIp(result.selectedPair.localCandidate.address),
      } : null,
      remoteCandidate: result.selectedPair.remoteCandidate ? {
        ...result.selectedPair.remoteCandidate,
        reachability: classifyIp(result.selectedPair.remoteCandidate.address),
      } : null,
    } : null,
    candidates,
    recommendation: summary.robustPublicRtcReachable
      ? 'RTC has a TURN relay or public host candidate.'
      : mediaConnected && selectedPublicMedia
        ? 'RTC connected over a public media candidate.'
      : mediaConnected && selectedTailnetOrLan
        ? 'RTC connected, but the selected path is private or tailnet; arbitrary public viewers still need off-tailnet verification or TURN.'
      : requireMediaConnected
        ? 'RTC offer succeeded, but no media path connected under the required test; add TURN/public media relay before enabling public RTC by default.'
      : summary.potentialPublicRtcReachable
        ? 'RTC has public STUN server-reflexive candidates; public viewers may connect directly, but off-tailnet browser verification is still required.'
      : 'RTC is currently LAN/tailnet candidate only; arbitrary public viewers should expect HLS fallback unless a TURN/public media relay is added.',
  }, null, 2))

  if (!result.ok || (requireMediaConnected && !mediaConnected)) process.exit(1)
} finally {
  await browser.close()
}
