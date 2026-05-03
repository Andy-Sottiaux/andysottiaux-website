'use client'

/**
 * FieldCameraFeed — live image from the field device, polled as JPEG
 * snapshots through a same-origin Edge proxy.
 *
 * Why snapshot polling instead of WebRTC:
 *   The previous implementation used WHEP (WebRTC over HTTP) signalled
 *   through `/api/v3/feed`. End-to-end through Edge runtime + the upstream
 *   funnel turned out to be unreliable (header stripping, ICE timing,
 *   non-trickle SDP quirks). For a portfolio visitor we don't need
 *   sub-second latency — we need a reliable "this thing is alive" frame.
 *   So we poll `/api/v3/snapshot` every 2s, swap an <img> src, and the
 *   feed reads as a ~0.5 fps live view. No signaling failure modes.
 *
 * States:
 *   - 'connecting'  : initial — never received a frame yet (shimmer).
 *   - 'live'        : at least one frame loaded recently.
 *   - 'offline'     : >POLL_GRACE_MS without a successful frame; show
 *                     the polished offline placeholder. Polling continues
 *                     in the background; transitions back to 'live' as
 *                     soon as a frame lands.
 *
 * Theme: shimmer + offline placeholder adapt to light/dark; the LIVE
 * pill stays constant.
 */

import { useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const SNAPSHOT_URL = '/api/v3/snapshot'
const POLL_INTERVAL_MS = 2000
const POLL_GRACE_MS = 30_000

type FeedState = 'connecting' | 'live' | 'offline'

export default function FieldCameraFeed() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  const imgRef = useRef<HTMLImageElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [state, setState] = useState<FeedState>('connecting')

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastOkAt = 0

    const swap = (objectUrl: string) => {
      const previous = objectUrlRef.current
      objectUrlRef.current = objectUrl
      if (imgRef.current) imgRef.current.src = objectUrl
      // Revoke the previous frame's blob URL one tick later so the <img>
      // has a chance to swap without flicker.
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
            const url = URL.createObjectURL(blob)
            swap(url)
            lastOkAt = Date.now()
            setState('live')
          } else {
            // 200 with empty/non-image body — treat as failure.
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
      // Never received a frame yet → straight to offline (don't pretend
      // we're still connecting after several poll failures).
      // Have a frame but it's gone stale beyond the grace window → offline.
      // Otherwise: keep the last live frame on screen, no UI thrash.
      if (lastOkAt === 0 || Date.now() - lastOkAt > POLL_GRACE_MS) {
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
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden rounded-[16px]">
      {/* Snapshot image — always mounted so frame swap is instant */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {/* Connecting shimmer — first paint until first frame lands */}
      {state === 'connecting' && (
        <FeedShimmer label="connecting…" isLight={isLight} />
      )}

      {/* Offline placeholder — polished, intentional. No retry countdown:
          polling continues in background and the card flips to live as soon
          as a frame lands. */}
      {state === 'offline' && (
        <FeedOffline isLight={isLight} />
      )}

      {/* Live indicator */}
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
