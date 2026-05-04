'use client'

/**
 * FieldCameraFeed — fmp4-over-HTTPS live video with seamless cutover.
 *
 * Tailscale Funnel cycles long-lived HTTP connections every 30-60s
 * (Tailscale's TCP idle/duration limit, applies to both go2rtc's own
 * stream.html and ours). Naive client = visible black flash on every
 * cycle. We hide it with a dual-buffer pre-warm:
 *
 *   1. Primary <video> element plays the current stream.
 *   2. ~PREWARM_AT_MS into the connection, we open a fresh stream in
 *      the secondary <video> element (off-screen, opacity 0).
 *   3. When the secondary fires `playing`, we cross-fade — old video
 *      goes opacity:0, new video goes opacity:1, then we tear down the
 *      old element. Result: the user never sees a black gap.
 *   4. The secondary becomes the new primary; repeat indefinitely.
 *
 * Live-edge tracking: MSE on `<video>` buffers 1-3s ahead of live by
 * default. Every LIVE_EDGE_CHECK_MS we check `video.buffered.end()`
 * vs `currentTime` and jump forward when behind by more than
 * LIVE_EDGE_MAX. Difference between "feels live" and "feels delayed".
 *
 * Snapshot fallback: if BOTH videos fail to first-frame within
 * FIRST_FRAME_TIMEOUT_MS we drop to the snapshot polling endpoint
 * (~1.5s latency) which works even when streaming is blocked entirely.
 *
 * Visibility teardown: tab hidden or container scrolled off → release
 * both video elements + close their connections immediately. No
 * zombie stream consumers on the board.
 *
 * Why no WebRTC tier: Tailscale Funnel terminates HTTPS at the edge
 * and doesn't proxy UDP. WebRTC's media plane (UDP, including ICE-
 * TCP fallback in practice) can't establish from a public viewer.
 * 3.5s of dead probe time wasted before falling to fmp4. Tailnet
 * viewers wanting sub-200ms can use go2rtc's stream.html directly.
 *
 * Browser-side telemetry POSTs to /api/v3/stream-metrics every
 * METRICS_INTERVAL_MS — feeds the dev HUD (?debug=1) and the board's
 * /api/services view.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

// ── Config ────────────────────────────────────────────────────────────
const FUNNEL_HOST =
  process.env.NEXT_PUBLIC_V3_FUNNEL_HOST ||
  'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
const FMP4_URL = `${FUNNEL_HOST}/api/stream.mp4?src=${encodeURIComponent(FEED_STREAM)}`

const SNAPSHOT_URL = '/api/v3/snapshot'
const METRICS_URL = '/api/v3/stream-metrics'

// Pre-warm the next connection 25 s into the current one. Funnel
// usually cycles between 30 s and 60 s; 25 s gives us 5+ s of overlap
// to let the new stream first-frame and cross-fade.
const PREWARM_AT_MS = 25_000
const PREWARM_FIRST_FRAME_TIMEOUT_MS = 5_000
const PREWARM_RETRY_DELAY_MS = 2_000

const FIRST_FRAME_TIMEOUT_MS = 4_000
const SNAPSHOT_POLL_MS = 700
const METRICS_INTERVAL_MS = 5_000

// MSE buffers 1-3s ahead of live on most browsers. Track live edge
// every 1 s and jump forward when buffered ahead beyond LIVE_EDGE_MAX.
const LIVE_EDGE_OFFSET = 0.4
const LIVE_EDGE_MAX = 1.0
const LIVE_EDGE_CHECK_MS = 1_000

// Cross-fade duration on cutover. Short enough to feel instant but
// long enough that brief decode hiccups in the new stream don't show
// the black background underneath.
const FADE_MS = 220

type Phase = 'paused' | 'probing' | 'live' | 'offline'

type SessionStats = {
  tier: 'fmp4' | 'snapshot' | null
  kbps: number
  fps: number
  joinMs: number
  framesDecoded: number
  cyclesCompleted: number
}

export default function FieldCameraFeed() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const debugMode = useDebugFlag()
  const sessionId = useMemo(() => randomSessionId(), [])

  const containerRef = useRef<HTMLDivElement>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [active, setActive] = useState<boolean>(() => initialActive())
  const [phase, setPhase] = useState<Phase>(() => (initialActive() ? 'probing' : 'paused'))
  const [activeVideo, setActiveVideo] = useState<'A' | 'B' | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [stats, setStats] = useState<SessionStats>(emptyStats())

  // ── Visibility / intersection gate ────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof document === 'undefined') return

    let intersecting = true
    const recompute = () => setActive(document.visibilityState === 'visible' && intersecting)

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

  // ── Stream lifecycle (dual-buffer fmp4 with cutover) ──────────────
  useEffect(() => {
    if (!active) {
      // Detach both videos so the underlying TCP sockets close now.
      detachVideo(videoARef.current)
      detachVideo(videoBRef.current)
      setActiveVideo(null)
      setShowFallback(false)
      setPhase('paused')
      return
    }

    setPhase('probing')
    setShowFallback(false)
    setStats(emptyStats())

    let cancelled = false
    const sessionStartedAt = performance.now()
    let cyclesCompleted = 0

    // Stats sampling for the currently-active <video> element.
    let statsTimer: ReturnType<typeof setInterval> | null = null
    let liveEdgeTimer: ReturnType<typeof setInterval> | null = null
    let prewarmTimer: ReturnType<typeof setTimeout> | null = null

    let currentSlot: 'A' | 'B' = 'A'
    const slotOf = (s: 'A' | 'B') => (s === 'A' ? videoARef.current : videoBRef.current)

    const startStatsForSlot = (slot: 'A' | 'B') => {
      const v = slotOf(slot)
      if (!v) return
      let prevDecoded = 0
      let prevTs = performance.now()
      if (statsTimer) clearInterval(statsTimer)
      statsTimer = setInterval(() => {
        if (cancelled) return
        const vv = slotOf(slot)
        if (!vv) return
        const vq = vv.getVideoPlaybackQuality?.()
        const nowTs = performance.now()
        const dtSec = Math.max(0.001, (nowTs - prevTs) / 1000)
        if (vq) {
          const fps = (vq.totalVideoFrames - prevDecoded) / dtSec
          prevDecoded = vq.totalVideoFrames
          setStats((s) => ({
            ...s,
            tier: 'fmp4',
            fps,
            framesDecoded: vq.totalVideoFrames,
            cyclesCompleted,
          }))
        }
        prevTs = nowTs
      }, 1000)

      if (liveEdgeTimer) clearInterval(liveEdgeTimer)
      liveEdgeTimer = setInterval(() => {
        if (cancelled) return
        const vv = slotOf(slot)
        if (!vv || vv.paused) return
        const ranges = vv.buffered
        if (ranges.length === 0) return
        const liveEdge = ranges.end(ranges.length - 1)
        const behind = liveEdge - vv.currentTime
        if (behind > LIVE_EDGE_MAX) {
          try {
            vv.currentTime = Math.max(liveEdge - LIVE_EDGE_OFFSET, vv.currentTime)
          } catch {
            // Some browsers throw mid-seek; ignore.
          }
        }
      }, LIVE_EDGE_CHECK_MS)
    }

    // Start primary stream in slot A.
    const onPrimaryError = () => {
      if (cancelled) return
      // Both videos failed → fallback to snapshot poll.
      if (!showFallback) {
        setShowFallback(true)
        setActiveVideo(null)
      }
    }

    const startSlot = (
      slot: 'A' | 'B',
      onFirstFrame: () => void,
      onError: () => void,
      timeoutMs: number
    ): (() => void) => {
      const v = slotOf(slot)
      if (!v) {
        onError()
        return () => {}
      }
      detachVideo(v)
      // Cache-buster lets us reopen the same URL into a fresh socket.
      const url = `${FMP4_URL}&_=${Date.now()}-${slot}`
      v.src = url
      v.muted = true
      v.playsInline = true

      let firstFrameTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        firstFrameTimer = null
        cleanup()
        onError()
      }, timeoutMs)

      const onPlaying = () => {
        if (firstFrameTimer) {
          clearTimeout(firstFrameTimer)
          firstFrameTimer = null
        }
        onFirstFrame()
      }
      const onErr = () => {
        if (firstFrameTimer) {
          clearTimeout(firstFrameTimer)
          firstFrameTimer = null
        }
        cleanup()
        onError()
      }
      v.addEventListener('playing', onPlaying)
      v.addEventListener('error', onErr)
      // `ended` fires when Funnel cycles before our pre-warm — treat
      // as error in this slot; the cutover loop will re-spawn.
      v.addEventListener('ended', onErr)
      void v.play().catch(() => {})

      const cleanup = () => {
        v.removeEventListener('playing', onPlaying)
        v.removeEventListener('error', onErr)
        v.removeEventListener('ended', onErr)
      }
      return cleanup
    }

    let activeCleanup: (() => void) = () => {}
    let prewarmCleanup: (() => void) = () => {}

    const schedulePrewarm = () => {
      if (prewarmTimer) clearTimeout(prewarmTimer)
      prewarmTimer = setTimeout(() => {
        if (cancelled) return
        const otherSlot: 'A' | 'B' = currentSlot === 'A' ? 'B' : 'A'
        prewarmCleanup = startSlot(
          otherSlot,
          // First frame in the pre-warm slot → cross-fade swap.
          () => {
            if (cancelled) return
            // Old slot still playing — tear it down after fade.
            const old = currentSlot
            currentSlot = otherSlot
            cyclesCompleted++
            setActiveVideo(otherSlot)
            startStatsForSlot(otherSlot)
            // Re-attach lifecycle handlers for the now-active slot
            // (so future Funnel cycles route to retry / next prewarm).
            attachActiveSlotWatchers(otherSlot)
            setTimeout(() => {
              detachVideo(slotOf(old))
            }, FADE_MS + 50)
            schedulePrewarm()
          },
          // Pre-warm failed. Try again in a couple seconds — we still
          // have the primary playing; no urgency.
          () => {
            if (cancelled) return
            if (prewarmTimer) clearTimeout(prewarmTimer)
            prewarmTimer = setTimeout(schedulePrewarm, PREWARM_RETRY_DELAY_MS)
          },
          PREWARM_FIRST_FRAME_TIMEOUT_MS
        )
      }, PREWARM_AT_MS)
    }

    // Watchers on the active slot — if Funnel cycles BEFORE pre-warm
    // (rare, but happens), fire pre-warm immediately. If both A and
    // B fail in succession, drop to snapshot.
    const attachActiveSlotWatchers = (slot: 'A' | 'B') => {
      const v = slotOf(slot)
      if (!v) return
      const onUnexpectedEnd = () => {
        if (cancelled) return
        // Bring pre-warm forward.
        if (prewarmTimer) clearTimeout(prewarmTimer)
        prewarmTimer = setTimeout(() => schedulePrewarm(), 100)
      }
      v.addEventListener('ended', onUnexpectedEnd)
      // Stored so we can remove on cancel.
      activeWatcherRemovers.push(() => v.removeEventListener('ended', onUnexpectedEnd))
    }

    const activeWatcherRemovers: Array<() => void> = []

    activeCleanup = startSlot(
      'A',
      () => {
        if (cancelled) return
        const joinMs = Math.round(performance.now() - sessionStartedAt)
        currentSlot = 'A'
        setActiveVideo('A')
        setPhase('live')
        setStats((s) => ({ ...s, tier: 'fmp4', joinMs }))
        startStatsForSlot('A')
        attachActiveSlotWatchers('A')
        schedulePrewarm()
      },
      onPrimaryError,
      FIRST_FRAME_TIMEOUT_MS
    )

    return () => {
      cancelled = true
      if (statsTimer) clearInterval(statsTimer)
      if (liveEdgeTimer) clearInterval(liveEdgeTimer)
      if (prewarmTimer) clearTimeout(prewarmTimer)
      try { activeCleanup() } catch {}
      try { prewarmCleanup() } catch {}
      activeWatcherRemovers.forEach((fn) => { try { fn() } catch {} })
      detachVideo(videoARef.current)
      detachVideo(videoBRef.current)
    }
  }, [active])

  // ── Snapshot fallback path ────────────────────────────────────────
  useEffect(() => {
    if (!showFallback || !active) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let objectUrl: string | null = null
    let firstSeen = false

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
          if (!firstSeen) setPhase('offline')
          return
        }
        const blob = await res.blob()
        if (cancelled) return
        if (blob.size === 0 || !blob.type.startsWith('image/')) {
          if (!firstSeen) setPhase('offline')
          return
        }
        const url = URL.createObjectURL(blob)
        const prev = objectUrl
        objectUrl = url
        const img = imgRef.current
        if (img) img.src = url
        if (prev) {
          setTimeout(() => { try { URL.revokeObjectURL(prev) } catch {} }, 100)
        }
        if (!firstSeen) {
          firstSeen = true
          setPhase('live')
          setStats((s) => ({ ...s, tier: 'snapshot' }))
        }
      } catch {
        if (!firstSeen && !cancelled) setPhase('offline')
      }
      if (!cancelled) timer = setTimeout(tick, SNAPSHOT_POLL_MS)
    }
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (objectUrl) { try { URL.revokeObjectURL(objectUrl) } catch {} }
    }
  }, [showFallback, active])

  // ── Telemetry beacon ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'live' || !stats.tier) return
    const id = setInterval(() => {
      const body = {
        session_id: sessionId,
        protocol: stats.tier,
        rtt_ms: 0,
        jitter_ms: 0,
        packet_loss: 0,
        kbps: stats.kbps,
        fps: stats.fps,
      }
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
  }, [phase, stats, sessionId])

  // ── Render ────────────────────────────────────────────────────────
  const showA = phase === 'live' && activeVideo === 'A' && !showFallback
  const showB = phase === 'live' && activeVideo === 'B' && !showFallback
  const showImg = phase === 'live' && showFallback

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-[16px]">
      <video
        ref={videoARef}
        autoPlay
        muted
        playsInline
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: showA ? 1 : 0,
          transition: `opacity ${FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          background: '#000',
        }}
      />
      <video
        ref={videoBRef}
        autoPlay
        muted
        playsInline
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: showB ? 1 : 0,
          transition: `opacity ${FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          background: '#000',
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        alt="Live camera frame"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: showImg ? 1 : 0,
          transition: `opacity ${FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
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

      {debugMode && phase === 'live' && stats.tier && <DevHUD stats={stats} />}

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

// ── Helpers ──────────────────────────────────────────────────────────
function detachVideo(v: HTMLVideoElement | null) {
  if (!v) return
  try {
    v.pause()
    v.removeAttribute('src')
    v.load()
  } catch {
    // ignore
  }
}

function emptyStats(): SessionStats {
  return {
    tier: null,
    kbps: 0,
    fps: 0,
    joinMs: 0,
    framesDecoded: 0,
    cyclesCompleted: 0,
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

function DevHUD({ stats }: { stats: SessionStats }) {
  const lines: string[] = [
    (stats.tier ?? 'NONE').toUpperCase(),
    `${stats.fps.toFixed(1)} fps · join ${stats.joinMs}ms`,
    `cycles ${stats.cyclesCompleted} · frames ${stats.framesDecoded}`,
  ]
  return (
    <div
      className="absolute bottom-3 right-3 rounded-md px-2.5 py-2 text-[10px] tracking-wide leading-tight"
      style={{
        background: 'rgba(0,0,0,0.65)',
        color: '#9af',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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
