'use client'

/**
 * FieldCameraFeed — adaptive 3-tier live video client.
 *
 * Picks the best transport that actually works for the viewer's
 * network, top-down:
 *
 *   1. WebRTC           sub-200 ms glass-to-glass, UDP, jitter-tolerant
 *   2. fmp4 over HTTPS  ~500-700 ms, TCP, restrictive networks
 *   3. snapshot poll    ~1-2 s floor, plain HTTPS GETs only
 *
 * (We don't include MJPEG — go2rtc-pure builds without ffmpeg can't
 * transcode H.264 → MJPEG, so the endpoint returns empty. Snapshot
 * poll covers the same "no streaming protocol allowed" use case.)
 *
 * The component PROBES tier-by-tier with a 3.5 s first-frame budget
 * each. The first tier to deliver a real frame wins and we stick.
 * On error it degrades one tier and tries again. Periodic re-probe
 * (every 5 min) tries to climb back up to a faster tier.
 *
 * While the tab is hidden / scrolled out of view, ALL transports
 * tear down so the board's wifi uplink isn't holding open consumers
 * for backgrounded tabs (the Apr-2026 zombie-consumer leak).
 *
 * Browser-side telemetry is POSTed back to /api/v3/stream-metrics
 * every 5 s for the board's stream-stats endpoint. This is what
 * powers the dev HUD ("?debug=1") and what /api/services exposes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

// ── Config ────────────────────────────────────────────────────────────
const FUNNEL_HOST =
  process.env.NEXT_PUBLIC_V3_FUNNEL_HOST ||
  'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'

// go2rtc 1.9 exposes /api/webrtc (JSON-SDP exchange), not WHEP standard.
// Body: {type:"offer", sdp:"..."} -> {type:"answer", sdp:"..."}.
const WEBRTC_URL = `${FUNNEL_HOST}/api/webrtc?src=${encodeURIComponent(FEED_STREAM)}`
const FMP4_URL = `${FUNNEL_HOST}/api/stream.mp4?src=${encodeURIComponent(FEED_STREAM)}`
const SNAPSHOT_URL = '/api/v3/snapshot'
const METRICS_URL = '/api/v3/stream-metrics'

const FIRST_FRAME_TIMEOUT_MS = 3500
const STALL_TIMEOUT_MS = 8000
const REPROBE_INTERVAL_MS = 5 * 60_000
const SNAPSHOT_POLL_MS = 700
const METRICS_INTERVAL_MS = 5_000
const RECONNECT_DELAY_MS = 250

// ── Types ─────────────────────────────────────────────────────────────
type Tier = 'webrtc' | 'fmp4' | 'snapshot'
type Phase =
  | 'paused' // user away or scrolled past
  | 'probing' // selecting a tier
  | 'live' // first frame seen, stream active
  | 'offline' // every tier failed; full retry cycle pending

const ALL_TIERS: Tier[] = ['webrtc', 'fmp4', 'snapshot']

type SessionStats = {
  tier: Tier | null
  rttMs: number
  jitterMs: number
  packetLoss: number
  kbps: number
  fps: number
  joinMs: number
  framesDecoded: number
}

// ── Component ─────────────────────────────────────────────────────────
export default function FieldCameraFeed() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  const debugMode = useDebugFlag()

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [active, setActive] = useState<boolean>(() => initialActive())
  const [phase, setPhase] = useState<Phase>(() => (initialActive() ? 'probing' : 'paused'))
  const [tier, setTier] = useState<Tier | null>(null)
  const [stats, setStats] = useState<SessionStats>(emptyStats())

  const sessionId = useMemo(() => randomSessionId(), [])

  // ── Visibility / intersection gate ─────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof document === 'undefined') return

    let intersecting = true
    const recompute = () => {
      const visible = document.visibilityState === 'visible'
      setActive(visible && intersecting)
    }

    const onVis = () => recompute()
    document.addEventListener('visibilitychange', onVis)

    let observer: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          intersecting = entries[0]?.isIntersecting ?? true
          recompute()
        },
        { threshold: 0.1 }
      )
      observer.observe(el)
    }
    recompute()

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (observer) observer.disconnect()
    }
  }, [])

  // ── Tier ladder, lifecycle ────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      setPhase('paused')
      return
    }
    setPhase('probing')

    let cancelled = false
    let teardown: (() => void) | null = null
    let tierIdx = 0
    let reprobeTimer: ReturnType<typeof setTimeout> | null = null
    const sessionStartedAt = performance.now()

    const onLive = (newTier: Tier) => {
      if (cancelled) return
      const joinMs = Math.round(performance.now() - sessionStartedAt)
      setTier(newTier)
      setPhase('live')
      setStats((s) => ({ ...s, tier: newTier, joinMs }))
    }

    const onStallOrError = () => {
      if (cancelled) return
      // Tear down current tier, advance.
      if (teardown) {
        try {
          teardown()
        } catch {
          // ignore
        }
        teardown = null
      }
      tierIdx++
      if (tierIdx >= ALL_TIERS.length) {
        setPhase('offline')
        // Full retry cycle from top after 15 s.
        const t = setTimeout(() => {
          if (cancelled) return
          tierIdx = 0
          tryNext()
        }, 15_000)
        reprobeTimer = t
        return
      }
      tryNext()
    }

    const onStatsUpdate = (patch: Partial<SessionStats>) => {
      if (cancelled) return
      setStats((s) => ({ ...s, ...patch }))
    }

    const tryNext = () => {
      if (cancelled) return
      const t = ALL_TIERS[tierIdx]
      const handlers = { onLive, onStallOrError, onStatsUpdate }
      switch (t) {
        case 'webrtc':
          teardown = startWebRTC(videoRef, handlers)
          break
        case 'fmp4':
          teardown = startFMP4(videoRef, handlers)
          break
        case 'snapshot':
          teardown = startSnapshot(imgRef, handlers)
          break
      }
    }

    tryNext()

    // Try to climb back to a higher tier every REPROBE_INTERVAL_MS while
    // we're stuck below WebRTC. (If WebRTC is already in use, no climb.)
    const climb = setInterval(() => {
      if (cancelled) return
      if (tierIdx === 0) return
      // Tear down current (degraded) tier, restart from top.
      if (teardown) {
        try {
          teardown()
        } catch {
          // ignore
        }
        teardown = null
      }
      tierIdx = 0
      tryNext()
    }, REPROBE_INTERVAL_MS)

    return () => {
      cancelled = true
      if (teardown) {
        try {
          teardown()
        } catch {
          // ignore
        }
      }
      clearInterval(climb)
      if (reprobeTimer) clearTimeout(reprobeTimer)
    }
  }, [active])

  // ── Telemetry beacon ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'live' || !tier) return
    const id = setInterval(() => {
      const body = {
        session_id: sessionId,
        protocol: tier,
        rtt_ms: stats.rttMs,
        jitter_ms: stats.jitterMs,
        packet_loss: stats.packetLoss,
        kbps: stats.kbps,
        fps: stats.fps,
      }
      // sendBeacon when available — survives unload cleanly.
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(METRICS_URL, new Blob([JSON.stringify(body)], { type: 'application/json' }))
        } else {
          fetch(METRICS_URL, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
          }).catch(() => {})
        }
      } catch {
        // ignore
      }
    }, METRICS_INTERVAL_MS)
    return () => clearInterval(id)
  }, [phase, tier, stats, sessionId])

  // ── Render ────────────────────────────────────────────────────────
  const usingVideo = tier === 'webrtc' || tier === 'fmp4'
  const usingImg = tier === 'snapshot'

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-[16px]">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        // preload=none + no src on mount; we drive src/srcObject from
        // the transport modules.
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: phase === 'live' && usingVideo ? 1 : 0,
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          background: '#000',
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        alt="Live camera frame"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: phase === 'live' && usingImg ? 1 : 0,
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          background: '#000',
        }}
      />

      {phase === 'probing' && <FeedShimmer label="connecting…" isLight={isLight} />}
      {phase === 'paused' && <FeedPaused />}
      {phase === 'offline' && <FeedOffline isLight={isLight} />}

      {phase === 'live' && (
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest"
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: '#ff453a',
              boxShadow: '0 0 6px #ff453a',
              animation: 'fldLivePulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
            }}
          />
          LIVE
        </div>
      )}

      {debugMode && phase === 'live' && tier && <DevHUD tier={tier} stats={stats} />}

      <style jsx global>{`
        @keyframes fldLivePulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        @keyframes fldShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fldPlaceholderPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%      { opacity: 0.85; transform: scale(1.04); }
        }
      `}</style>
    </div>
  )
}

// ── Tier 1: WebRTC / WHEP ─────────────────────────────────────────────
type TierHandlers = {
  onLive: (tier: Tier) => void
  onStallOrError: () => void
  onStatsUpdate: (patch: Partial<SessionStats>) => void
}

function startWebRTC(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  handlers: TierHandlers
): () => void {
  let cancelled = false
  let pc: RTCPeerConnection | null = null
  let firstFrameTimer: ReturnType<typeof setTimeout> | null = null
  let statsTimer: ReturnType<typeof setInterval> | null = null
  let prevBytesRecv = 0
  let prevFramesDecoded = 0
  let prevTs = performance.now()

  const tearDown = () => {
    cancelled = true
    if (firstFrameTimer) clearTimeout(firstFrameTimer)
    if (statsTimer) clearInterval(statsTimer)
    if (pc) {
      try {
        pc.getSenders().forEach((s) => s.track?.stop())
        pc.close()
      } catch {
        // ignore
      }
      pc = null
    }
    const v = videoRef.current
    if (v) {
      try {
        v.srcObject = null
      } catch {
        // ignore
      }
    }
  }

  ;(async () => {
    try {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        // Bundle reduces connection setup chatter — important for our
        // sub-3.5s first-frame budget.
        bundlePolicy: 'max-bundle',
      })
      pc.addTransceiver('video', { direction: 'recvonly' })

      pc.ontrack = (ev) => {
        if (cancelled) return
        const v = videoRef.current
        if (!v) return
        v.srcObject = ev.streams[0] ?? new MediaStream([ev.track])
        const onPlaying = () => {
          if (cancelled) return
          handlers.onLive('webrtc')
        }
        v.addEventListener('playing', onPlaying, { once: true })
      }

      const offer = await pc.createOffer({ offerToReceiveVideo: true })
      await pc.setLocalDescription(offer)
      // Wait for ICE gathering to complete (or 1.5s, whichever is first)
      // so the SDP we POST to WHEP includes our candidates.
      await iceGatheringDone(pc, 1500)

      if (cancelled) return

      // go2rtc's WebRTC endpoint takes JSON {type, sdp} and returns the
      // same shape. (It pre-dates the WHEP standard by enough that the
      // WHEP path isn't routed in 1.9.14.)
      const resp = await fetch(WEBRTC_URL, {
        method: 'POST',
        body: JSON.stringify({
          type: pc.localDescription?.type ?? 'offer',
          sdp: pc.localDescription?.sdp ?? '',
        }),
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })
      if (!resp.ok) throw new Error('webrtc ' + resp.status)
      const answer = (await resp.json()) as { type: string; sdp: string }
      if (cancelled) return
      await pc.setRemoteDescription({
        type: (answer.type as RTCSdpType) ?? 'answer',
        sdp: answer.sdp,
      })

      // First-frame deadline: if `playing` doesn't fire in time, advance.
      firstFrameTimer = setTimeout(() => {
        if (!cancelled) handlers.onStallOrError()
      }, FIRST_FRAME_TIMEOUT_MS)

      // RTC stats every 1s — actual measured RTT/jitter/loss.
      statsTimer = setInterval(async () => {
        if (cancelled || !pc) return
        try {
          const report = await pc.getStats()
          let inboundBytes = 0
          let framesDecoded = 0
          let jitter = 0
          let packetsLost = 0
          let packetsReceived = 0
          let rtt = 0

          report.forEach((s) => {
            if (s.type === 'inbound-rtp' && s.kind === 'video') {
              inboundBytes = s.bytesReceived ?? 0
              framesDecoded = s.framesDecoded ?? 0
              jitter = s.jitter ?? 0
              packetsLost = s.packetsLost ?? 0
              packetsReceived = s.packetsReceived ?? 0
            } else if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated) {
              rtt = s.currentRoundTripTime ?? 0
            }
          })

          const nowTs = performance.now()
          const dtSec = Math.max(0.001, (nowTs - prevTs) / 1000)
          const kbps = ((inboundBytes - prevBytesRecv) * 8) / 1000 / dtSec
          const fps = (framesDecoded - prevFramesDecoded) / dtSec
          prevBytesRecv = inboundBytes
          prevFramesDecoded = framesDecoded
          prevTs = nowTs

          const total = packetsLost + packetsReceived
          const loss = total > 0 ? packetsLost / total : 0

          handlers.onStatsUpdate({
            kbps,
            fps,
            rttMs: rtt * 1000,
            jitterMs: jitter * 1000,
            packetLoss: loss,
            framesDecoded,
          })
          // If we've seen ≥1 decoded frame, the live event has already
          // fired via 'playing'. Belt and braces.
          if (framesDecoded > 0 && firstFrameTimer) {
            clearTimeout(firstFrameTimer)
            firstFrameTimer = null
          }
        } catch {
          // ignore one-shot stats failures
        }
      }, 1000)

      // Watchdog: PC connection state degrades → bail.
      pc.onconnectionstatechange = () => {
        if (!pc) return
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          if (!cancelled) handlers.onStallOrError()
        }
      }
    } catch {
      if (!cancelled) handlers.onStallOrError()
    }
  })()

  return tearDown
}

function iceGatheringDone(pc: RTCPeerConnection, maxWaitMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', listener)
      resolve()
    }, maxWaitMs)
    const listener = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t)
        pc.removeEventListener('icegatheringstatechange', listener)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', listener)
  })
}

// ── Tier 2: fmp4 over HTTPS ──────────────────────────────────────────
function startFMP4(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  handlers: TierHandlers
): () => void {
  let cancelled = false
  let firstFrameTimer: ReturnType<typeof setTimeout> | null = null
  let stallTimer: ReturnType<typeof setTimeout> | null = null
  let statsTimer: ReturnType<typeof setInterval> | null = null
  let lastPlaybackTime = 0
  let prevDecoded = 0
  let prevTs = performance.now()
  const v = videoRef.current

  const onPlaying = () => {
    if (cancelled) return
    handlers.onLive('fmp4')
    if (firstFrameTimer) {
      clearTimeout(firstFrameTimer)
      firstFrameTimer = null
    }
  }
  const onError = () => {
    if (!cancelled) handlers.onStallOrError()
  }
  const onEnded = () => {
    // Funnel cycles long-lived connections; quick reconnect.
    if (cancelled || !videoRef.current) return
    setTimeout(() => {
      if (cancelled) return
      const v2 = videoRef.current
      if (!v2) return
      try {
        v2.src = `${FMP4_URL}&_=${Date.now()}`
        void v2.play().catch(() => {})
      } catch {
        // ignore
      }
    }, RECONNECT_DELAY_MS)
  }

  if (v) {
    v.srcObject = null
    v.src = FMP4_URL
    v.addEventListener('playing', onPlaying)
    v.addEventListener('error', onError)
    v.addEventListener('ended', onEnded)
    void v.play().catch(() => {})

    firstFrameTimer = setTimeout(() => {
      if (!cancelled) handlers.onStallOrError()
    }, FIRST_FRAME_TIMEOUT_MS)

    // Stall watchdog: currentTime not advancing → bail.
    stallTimer = setInterval(() => {
      if (cancelled || !videoRef.current) return
      if (videoRef.current.currentTime <= lastPlaybackTime + 0.01) {
        // Could be normal (paused, buffering) — only escalate if no frame
        // has played in STALL_TIMEOUT_MS while readyState says we should.
        if (videoRef.current.readyState >= 2 && !videoRef.current.paused) {
          handlers.onStallOrError()
        }
      }
      lastPlaybackTime = videoRef.current.currentTime
    }, STALL_TIMEOUT_MS)

    // Bitrate / FPS estimation via the videoElement's webkit-* and W3C
    // VideoPlaybackQuality. Keep it cheap — 1s.
    statsTimer = setInterval(() => {
      if (cancelled || !videoRef.current) return
      const vq = videoRef.current.getVideoPlaybackQuality?.()
      if (!vq) return
      const nowTs = performance.now()
      const dtSec = Math.max(0.001, (nowTs - prevTs) / 1000)
      const fps = (vq.totalVideoFrames - prevDecoded) / dtSec
      prevDecoded = vq.totalVideoFrames
      prevTs = nowTs
      handlers.onStatsUpdate({ fps, framesDecoded: vq.totalVideoFrames })
    }, 1000)
  } else {
    // No video element — bail immediately.
    setTimeout(() => {
      if (!cancelled) handlers.onStallOrError()
    }, 50)
  }

  return () => {
    cancelled = true
    if (firstFrameTimer) clearTimeout(firstFrameTimer)
    if (stallTimer) clearInterval(stallTimer)
    if (statsTimer) clearInterval(statsTimer)
    if (v) {
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('error', onError)
      v.removeEventListener('ended', onEnded)
      try {
        v.pause()
        v.removeAttribute('src')
        v.load()
      } catch {
        // ignore
      }
    }
  }
}

// ── Tier 3: snapshot poll ────────────────────────────────────────────
function startSnapshot(
  imgRef: React.RefObject<HTMLImageElement | null>,
  handlers: TierHandlers
): () => void {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let objectUrl: string | null = null
  let firstSeen = false
  let lastTs = performance.now()
  let frames = 0

  const tick = async () => {
    if (cancelled) return
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (cancelled) return
      if (!res.ok) {
        handlers.onStallOrError()
        return
      }
      const blob = await res.blob()
      if (cancelled) return
      if (blob.size === 0 || !blob.type.startsWith('image/')) {
        handlers.onStallOrError()
        return
      }
      const url = URL.createObjectURL(blob)
      const prev = objectUrl
      objectUrl = url
      const img = imgRef.current
      if (img) img.src = url
      if (prev) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(prev)
          } catch {
            // ignore
          }
        }, 100)
      }
      if (!firstSeen) {
        firstSeen = true
        handlers.onLive('snapshot')
      }
      frames++
      const nowTs = performance.now()
      if (nowTs - lastTs > 1000) {
        const fps = (frames * 1000) / (nowTs - lastTs)
        handlers.onStatsUpdate({ fps, framesDecoded: frames })
        lastTs = nowTs
        frames = 0
      }
    } catch {
      if (!cancelled) handlers.onStallOrError()
      return
    }
    if (!cancelled) timer = setTimeout(tick, SNAPSHOT_POLL_MS)
  }
  void tick()

  return () => {
    cancelled = true
    if (timer) clearTimeout(timer)
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {
        // ignore
      }
    }
    const img = imgRef.current
    if (img) {
      try {
        img.src = ''
      } catch {
        // ignore
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function emptyStats(): SessionStats {
  return {
    tier: null,
    rttMs: 0,
    jitterMs: 0,
    packetLoss: 0,
    kbps: 0,
    fps: 0,
    joinMs: 0,
    framesDecoded: 0,
  }
}

function initialActive(): boolean {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'visible'
}

function randomSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function useDebugFlag(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    setOn(url.searchParams.get('debug') === '1')
  }, [])
  return on
}

// ── Subcomponents ────────────────────────────────────────────────────
function FeedShimmer({ label, isLight }: { label: string; isLight: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: isLight
          ? 'linear-gradient(105deg, #ececef 25%, #f6f6f8 50%, #ececef 75%)'
          : 'linear-gradient(105deg, #0a0a0c 25%, #16161a 50%, #0a0a0c 75%)',
        backgroundSize: '200% 100%',
        animation: 'fldShimmer 2.4s linear infinite',
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <CameraGlyph isLight={isLight} />
        <div
          className="text-[11px] uppercase tracking-[0.2em] font-medium"
          style={{ color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

function FeedPaused() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: '#000' }}
    >
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <CameraGlyph dim isLight={false} />
        <div
          className="text-[11px] uppercase tracking-[0.18em] font-medium"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          paused
        </div>
      </div>
    </div>
  )
}

function FeedOffline({ isLight }: { isLight: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: isLight
          ? 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(10,132,255,0.05), transparent 70%), #f0f0f3'
          : 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(10,132,255,0.06), transparent 70%), #08080a',
      }}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div style={{ animation: 'fldPlaceholderPulse 2.8s cubic-bezier(0.4,0,0.6,1) infinite' }}>
          <CameraGlyph dim isLight={isLight} />
        </div>
        <div
          className="text-[13px] font-medium tracking-tight"
          style={{ color: isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)' }}
        >
          Camera offline
        </div>
        <div
          className="text-[11px] tracking-wide"
          style={{ color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}
        >
          Reconnecting…
        </div>
      </div>
    </div>
  )
}

// Dev HUD — switch on with ?debug=1. Mirrors what go2rtc / VMS dashboards
// show: protocol, bitrate, fps, RTT, jitter, loss, join time. Tiny so it
// doesn't dominate the frame.
function DevHUD({ tier, stats }: { tier: Tier; stats: SessionStats }) {
  const lines: string[] = [
    `${tier.toUpperCase()}`,
    `${Math.round(stats.kbps)} kbps · ${stats.fps.toFixed(1)} fps`,
  ]
  if (tier === 'webrtc') {
    lines.push(
      `rtt ${Math.round(stats.rttMs)}ms · jitter ${Math.round(stats.jitterMs)}ms · loss ${(stats.packetLoss * 100).toFixed(1)}%`
    )
  }
  lines.push(`join ${stats.joinMs}ms · frames ${stats.framesDecoded}`)
  return (
    <div
      className="absolute bottom-3 right-3 rounded-md px-2.5 py-2 text-[10px] tracking-wide leading-tight"
      style={{
        background: 'rgba(0,0,0,0.65)',
        color: '#9af',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        maxWidth: '60%',
      }}
    >
      {lines.map((l, i) => (
        <div key={i} className="tabular-nums">
          {l}
        </div>
      ))}
    </div>
  )
}

function CameraGlyph({ dim = false, isLight = false }: { dim?: boolean; isLight?: boolean }) {
  const color = isLight
    ? dim
      ? 'rgba(0,0,0,0.32)'
      : 'rgba(0,0,0,0.5)'
    : dim
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(255,255,255,0.55)'
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color }}
    >
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
      <circle cx="12" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}
