'use client'

/**
 * FieldCameraFeed — live video from the field device.
 *
 * Primary path: a fragmented-MP4 H.264 stream proxied through
 * `/api/v3/feed.mp4`. The browser plays it directly via <video>; rkipc
 * HW-encodes once, go2rtc rewraps RTSP→fmp4 with no transcoding, so
 * the board pays essentially zero extra CPU. End-to-end lag is the
 * ~150 ms encoder pipeline plus network — typically under 1 s.
 *
 * Vercel Edge has a ~25–30 s response cap on a streamed body. When
 * the upstream connection ends, the <video> fires `ended`/`stalled`
 * and we remount it to reconnect. The seam is invisible to the user
 * (~100 ms gap) because we keep the previous element painted until
 * the new one decodes its first frame.
 *
 * Fallback path: if the <video> errors three times in a row (e.g. an
 * older browser without the right H.264 profile, or the streaming
 * proxy is down), we transparently switch to the legacy
 * `/api/v3/snapshot` poll-and-swap. Same visual treatment, lower
 * latency, just no buffering. The fallback never re-promotes itself
 * back to streaming during this session — once snapshot mode wins,
 * stick with it for stability.
 *
 * States:
 *   - 'connecting' : initial — never received a frame yet (shimmer).
 *   - 'live'       : at least one frame arrived recently.
 *   - 'offline'    : > FRESH_GRACE_MS without a successful frame.
 */

import { useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const FEED_URL = '/api/v3/feed.mp4'
const SNAPSHOT_URL = '/api/v3/snapshot'
const POLL_INTERVAL_MS = 500
const FRESH_GRACE_MS = 30_000
const RECONNECT_DELAY_MS = 200
const FALLBACK_AFTER_FAILURES = 3

type FeedState = 'connecting' | 'live' | 'offline'

export default function FieldCameraFeed() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  const [state, setState] = useState<FeedState>('connecting')
  const [streamGen, setStreamGen] = useState(0) // bumped to remount <video>
  const [fallback, setFallback] = useState(false)

  const failureCountRef = useRef(0)
  const lastOkAtRef = useRef(0)

  // Stream-mode reconnect: when the <video> ends or errors, schedule a
  // remount. Counts errors so we can fall back to JPEG polling if the
  // browser can't keep up with fmp4.
  const handleStreamEnd = () => {
    // Stream-end (Edge proxy hitting its response cap) is normal — do not
    // count it against the failure budget.
    setTimeout(() => setStreamGen((g) => g + 1), RECONNECT_DELAY_MS)
  }
  const handleStreamError = () => {
    failureCountRef.current += 1
    if (failureCountRef.current >= FALLBACK_AFTER_FAILURES) {
      setFallback(true)
      return
    }
    setTimeout(() => setStreamGen((g) => g + 1), RECONNECT_DELAY_MS)
  }
  const handleStreamPlaying = () => {
    failureCountRef.current = 0
    lastOkAtRef.current = Date.now()
    setState('live')
  }

  // Snapshot fallback: poll-and-swap.
  const imgRef = useRef<HTMLImageElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fallback) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const swap = (url: string) => {
      const previous = objectUrlRef.current
      objectUrlRef.current = url
      if (imgRef.current) imgRef.current.src = url
      if (previous) {
        setTimeout(() => {
          try { URL.revokeObjectURL(previous) } catch {}
        }, 100)
      }
    }

    const tick = async () => {
      if (cancelled) return
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 5000)
        const res = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, {
          cache: 'no-store',
          signal: ctrl.signal,
        })
        clearTimeout(t)
        if (cancelled) return
        if (res.ok) {
          const blob = await res.blob()
          if (cancelled) return
          if (blob.size > 0 && blob.type.startsWith('image/')) {
            swap(URL.createObjectURL(blob))
            lastOkAtRef.current = Date.now()
            setState('live')
          } else {
            maybeOffline()
          }
        } else {
          maybeOffline()
        }
      } catch {
        if (!cancelled) maybeOffline()
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    const maybeOffline = () => {
      if (lastOkAtRef.current === 0 || Date.now() - lastOkAtRef.current > FRESH_GRACE_MS) {
        setState('offline')
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (objectUrlRef.current) {
        try { URL.revokeObjectURL(objectUrlRef.current) } catch {}
        objectUrlRef.current = null
      }
    }
  }, [fallback])

  // Watchdog: in stream mode, if we haven't seen a 'playing' event in
  // FRESH_GRACE_MS, surface the offline placeholder. Doesn't kill the
  // <video>; if a frame later lands, state flips back to 'live'.
  useEffect(() => {
    if (fallback) return
    const id = setInterval(() => {
      if (lastOkAtRef.current === 0) return
      if (Date.now() - lastOkAtRef.current > FRESH_GRACE_MS) {
        setState('offline')
      }
    }, 5000)
    return () => clearInterval(id)
  }, [fallback])

  return (
    <div className="relative w-full h-full overflow-hidden rounded-[16px]">
      {fallback ? (
        // Snapshot fallback path.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          alt="Live camera frame"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: state === 'live' ? 1 : 0,
            transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            background: '#000',
          }}
        />
      ) : (
        // Streaming path. `key` bump on streamGen forces a clean remount
        // when the upstream cycles or errors. autoPlay+muted are required
        // for autoplay policies; playsInline keeps mobile from going full
        // screen.
        <video
          key={streamGen}
          src={FEED_URL}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: state === 'live' ? 1 : 0,
            transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            background: '#000',
          }}
          onPlaying={handleStreamPlaying}
          onEnded={handleStreamEnd}
          onError={handleStreamError}
          onStalled={handleStreamEnd}
        />
      )}

      {state === 'connecting' && (
        <FeedShimmer label="connecting…" isLight={isLight} />
      )}

      {state === 'offline' && <FeedOffline isLight={isLight} />}

      {state === 'live' && (
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest"
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{
            background: '#ff453a',
            boxShadow: '0 0 6px #ff453a',
            animation: 'fldLivePulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
          }} />
          LIVE
        </div>
      )}

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

function CameraGlyph({ dim = false, isLight = false }: { dim?: boolean; isLight?: boolean }) {
  const color = isLight
    ? (dim ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.5)')
    : (dim ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)')
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
