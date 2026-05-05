'use client'

/**
 * FieldCameraFeed — embeds go2rtc's native player.
 *
 * The previous implementation pulled `/api/stream.mp4` directly and tried to
 * hide Funnel connection churn with dual <video> elements. Field testing showed
 * that path is both slow and fragile: fMP4 downloads arrive at low throughput
 * over Funnel and go2rtc 1.9.14 has panicked in the MP4 HTTP consumer.
 *
 * go2rtc's native `stream.html` can negotiate WebRTC/MSE/MJPEG fallback, but
 * that starts multiple consumers in parallel before selecting one. The public
 * site uses one MSE transport so one visible player maps to one board consumer.
 * The iframe is cover-cropped into the card because the native substream is
 * 704x576 while the homepage card is intentionally wide.
 * It must stay iframe-based because go2rtc rejects cross-origin
 * WebSocket upgrades from andysottiaux.com; the iframe keeps the page origin on
 * the Funnel host where the native player is accepted.
 */

import { useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const FUNNEL_HOST =
  process.env.NEXT_PUBLIC_V3_FUNNEL_HOST ||
  'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'mse'
const STREAM_COVER_HEIGHT = '145.5%'

const NATIVE_PLAYER_URL =
  `${FUNNEL_HOST}/stream.html` +
  `?src=${encodeURIComponent(FEED_STREAM)}` +
  `&mode=${encodeURIComponent(PLAYER_MODE)}` +
  '&background=false' +
  '&width=100%'

const LOAD_TIMEOUT_MS = 10_000

type Phase = 'paused' | 'connecting' | 'live' | 'offline'

export default function FieldCameraFeed({ enabled = true }: { enabled?: boolean }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const debugMode = useDebugFlag()
  const containerRef = useRef<HTMLDivElement>(null)

  const [active, setActive] = useState<boolean>(() => enabled && initialActive())
  const [phase, setPhase] = useState<Phase>(() => (enabled && initialActive() ? 'connecting' : 'paused'))
  const [reloadNonce, setReloadNonce] = useState(0)
  const iframeSrc = active ? `${NATIVE_PLAYER_URL}&_=${reloadNonce}` : ''

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof document === 'undefined') return

    let intersecting = true
    const recompute = () => setActive(enabled && document.visibilityState === 'visible' && intersecting)

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
      observer?.disconnect()
    }
  }, [enabled])

  useEffect(() => {
    if (!active) {
      setPhase('paused')
      return
    }

    setPhase('connecting')
    const id = window.setTimeout(() => {
      setPhase((p) => (p === 'connecting' ? 'offline' : p))
    }, LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(id)
  }, [active, reloadNonce])

  const reload = () => {
    setPhase('connecting')
    setReloadNonce((n) => n + 1)
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-[16px] bg-black">
      {iframeSrc && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
          <div
            className="relative overflow-hidden bg-black"
            style={{
              width: '100%',
              height: STREAM_COVER_HEIGHT,
            }}
          >
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              title="Cayley field camera live stream"
              allow="autoplay; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
              scrolling="no"
              className="absolute inset-0 h-full w-full border-0"
              style={{
                background: '#000',
                display: 'block',
              }}
              onLoad={() => setPhase('live')}
            />
          </div>
        </div>
      )}

      {phase === 'connecting' && <FeedShimmer label="opening native stream..." isLight={isLight} />}
      {phase === 'paused' && <FeedPaused />}
      {phase === 'offline' && <FeedOffline isLight={isLight} onRetry={reload} />}

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

      {debugMode && <DevHUD phase={phase} />}

      <a
        href={NATIVE_PLAYER_URL}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
        style={{
          background: 'rgba(0,0,0,0.58)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        native
      </a>

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

function initialActive(): boolean {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'visible'
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
          paused off-screen
        </div>
      </div>
    </div>
  )
}

function FeedOffline({ isLight, onRetry }: { isLight: boolean; onRetry: () => void }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: isLight ? '#f1f1f3' : '#050506' }}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <CameraGlyph dim isLight={isLight} />
        <div
          className="text-[11px] uppercase tracking-[0.18em] font-medium"
          style={{ color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)' }}
        >
          stream unavailable
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-widest transition-transform hover:scale-[1.03]"
          style={{
            color: isLight ? '#0b0b0c' : '#fff',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)'}`,
            background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.08)',
          }}
        >
          retry
        </button>
      </div>
    </div>
  )
}

function CameraGlyph({ dim = false, isLight }: { dim?: boolean; isLight: boolean }) {
  const stroke = isLight ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.52)'
  const fill = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 42 42"
      fill="none"
      style={{
        opacity: dim ? 0.55 : 1,
        animation: dim ? undefined : 'fldPlaceholderPulse 2.4s ease-in-out infinite',
      }}
    >
      <rect x="8" y="13" width="26" height="18" rx="5" fill={fill} stroke={stroke} />
      <path d="M15 13l2.4-3h7.2l2.4 3" stroke={stroke} strokeLinecap="round" />
      <circle cx="21" cy="22" r="5.5" stroke={stroke} />
      <circle cx="21" cy="22" r="2" fill={stroke} />
    </svg>
  )
}

function DevHUD({ phase }: { phase: Phase }) {
  return (
    <div
      className="absolute bottom-3 left-3 rounded-lg px-2.5 py-2 text-[10px] font-mono leading-relaxed"
      style={{
        background: 'rgba(0,0,0,0.72)',
        color: '#d7fbe8',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div>tier:native-go2rtc</div>
      <div>mode:iframe {PLAYER_MODE}</div>
      <div>phase:{phase}</div>
    </div>
  )
}
