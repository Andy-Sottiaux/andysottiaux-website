'use client'

/**
 * FieldCameraFeed — live video from the field device.
 *
 * Primary path: a fragmented-MP4 H.264 stream served straight from the
 * device's Tailscale Funnel hostname. rkipc HW-encodes once, go2rtc
 * rewraps RTSP packets into fmp4 with no transcoding, browser decodes
 * natively in <video>. End-to-end latency ~400-700 ms, board CPU
 * cost effectively zero above what the encoder was already burning.
 *
 * Why direct from the funnel and not via Vercel Edge: we tested Edge
 * pass-through and it truncates long-lived binary streams after the
 * fmp4 init segment (~108 bytes) because it can't bridge the
 * keyframe-wait quiet period that follows. Edge is great for SSE/text
 * streaming, not for binary video. The "cost" of going direct is
 * exposing the funnel hostname in DevTools — acceptable: the same
 * hostname could be discovered via Tailscale's public DNS anyway, and
 * the only thing it routes is cayley-app's existing read-only API.
 *
 * Fallback path: if the <video> errors (corp networks blocking
 * .ts.net, ad blockers, browser blocking the funnel cert, an old
 * browser without H.264 High@4.0 support, etc.) we drop to the
 * /api/v3/snapshot poll-and-swap path. Same visual treatment, lower
 * latency floor (~1.5 s) but rock-solid.
 *
 * Tailscale Funnel does close long-lived connections at some point;
 * <video> fires `ended` and we remount with a fresh src.
 *
 * States:
 *   - 'connecting' : first paint, no frame yet (shimmer).
 *   - 'live'       : stream playing OR snapshot lease fresh.
 *   - 'offline'    : > FRESH_GRACE_MS without a frame.
 */

import { useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const FUNNEL_HOST =
  process.env.NEXT_PUBLIC_V3_FUNNEL_HOST ||
  'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
const FEED_URL = `${FUNNEL_HOST}/api/stream.mp4?src=${encodeURIComponent(FEED_STREAM)}`

const SNAPSHOT_URL = '/api/v3/snapshot'
const POLL_INTERVAL_MS = 500
const FRESH_GRACE_MS = 30_000
const RECONNECT_DELAY_MS = 200

type FeedState = 'connecting' | 'live' | 'offline'

export default function FieldCameraFeed() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  const [state, setState] = useState<FeedState>('connecting')
  const [streamGen, setStreamGen] = useState(0)
  const [fallback, setFallback] = useState(false)

  const lastOkAtRef = useRef(0)

  // ── Streaming path ────────────────────────────────────────────────
  // Stream-end (funnel cycling) → reconnect with a new <video>.
  // Stream-error (network/codec issue) → fall back to snapshots.
  const onStreamEnd = () => {
    setTimeout(() => setStreamGen((g) => g + 1), RECONNECT_DELAY_MS)
  }
  const onStreamError = () => {
    setFallback(true)
  }
  const onStreamPlaying = () => {
    lastOkAtRef.current = Date.now()
    setState('live')
  }

  // ── Snapshot fallback ─────────────────────────────────────────────
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

  // ── Watchdog ──────────────────────────────────────────────────────
  // If we go FRESH_GRACE_MS without a 'playing' or snapshot success,
  // surface offline. Doesn't tear down anything; flips back to live as
  // soon as a frame lands.
  useEffect(() => {
    const id = setInterval(() => {
      if (lastOkAtRef.current === 0) return
      if (Date.now() - lastOkAtRef.current > FRESH_GRACE_MS) {
        setState('offline')
      }
    }, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden rounded-[16px]">
      {fallback ? (
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
          onPlaying={onStreamPlaying}
          onEnded={onStreamEnd}
          onError={onStreamError}
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
