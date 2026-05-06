'use client'

/**
 * FieldCameraFeed — embeds go2rtc's browser player without the native page.
 *
 * The previous implementation pulled `/api/stream.mp4` directly and tried to
 * hide Funnel connection churn with dual <video> elements. Field testing showed
 * that path is both slow and fragile: fMP4 downloads arrive at low throughput
 * over Funnel and go2rtc 1.9.14 has panicked in the MP4 HTTP consumer.
 *
 * go2rtc's native `stream.html` is a whole page, not a reusable video surface.
 * Scaling that page made the timestamp/status overlays too large and caused
 * awkward crops in the homepage card. The board now allows CORS for the API, so
 * the site loads go2rtc's `video-stream` web component directly and keeps the
 * full 704x576 camera frame visible inside responsive cards.
 */

import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const CAMERA_HOST =
  process.env.NEXT_PUBLIC_V3_CAMERA_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'
const FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'webrtc,mse,mjpeg'
const ENCODER_FPS = 10
const ENCODER_CODEC = 'H.264'
const ENCODER_MAX_KBPS = 512

const NATIVE_PLAYER_URL =
  `${CAMERA_HOST}/stream.html` +
  `?src=${encodeURIComponent(FEED_STREAM)}` +
  `&mode=${encodeURIComponent(PLAYER_MODE)}` +
  '&background=false' +
  '&width=100%'

const LOAD_TIMEOUT_MS = 10_000

type Phase = 'paused' | 'connecting' | 'live' | 'offline'
type VideoFit = 'contain' | 'cover' | 'fill'

type CameraHealthOverlay = {
  batteryVoltage?: number
  cameraState?: string
  outputSize?: string
  performanceScore?: number
  solarPower?: number
  tempC?: number
}

type HealthPayload = {
  system?: {
    cpu_temp_c?: number
    media_graph?: {
      output_size?: string
      state?: string
      visual_quality?: string
      working?: boolean
    }
    performance?: {
      score?: number
      status?: string
    }
  }
}

type SolarPayload = {
  battery_voltage?: number
  live?: boolean
  solar_power?: number
  stale?: boolean
}

type Go2RTCPlayerElement = HTMLElement & {
  background: boolean
  media: string
  mode: string
  src: string | URL
  video?: HTMLVideoElement
  visibilityCheck: boolean
  visibilityThreshold: number
}

declare global {
  interface Window {
    __cayleyVideoStreamScript?: Promise<void>
  }
}

export default function FieldCameraFeed({
  enabled = true,
  fit = 'contain',
  position = 'center center',
}: {
  enabled?: boolean
  fit?: VideoFit
  position?: string
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const debugMode = useDebugFlag()
  const overlay = useCameraHealthOverlay()
  const containerRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)

  const [active, setActive] = useState<boolean>(() => enabled && initialActive())
  const [phase, setPhase] = useState<Phase>(() => (enabled && initialActive() ? 'connecting' : 'paused'))
  const [reloadNonce, setReloadNonce] = useState(0)

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

    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let player: Go2RTCPlayerElement | null = null
    let video: HTMLVideoElement | null = null
    let bindTimer = 0
    const cleanups: Array<() => void> = []

    setPhase('connecting')
    mount.replaceChildren()

    const timeout = window.setTimeout(() => {
      setPhase((p) => (p === 'connecting' ? 'offline' : p))
    }, LOAD_TIMEOUT_MS)

    loadVideoStreamScript()
      .then(() => {
        if (disposed) return

        player = document.createElement('video-stream') as Go2RTCPlayerElement
        player.className = 'field-camera-player'
        player.style.display = 'block'
        player.style.width = '100%'
        player.style.height = '100%'
        player.style.background = '#000'
        mount.replaceChildren(player)

        player.background = false
        player.media = 'video'
        player.mode = PLAYER_MODE
        player.visibilityCheck = true
        player.visibilityThreshold = 0.1
        player.src = playerWsUrl(reloadNonce)

        const bindVideo = () => {
          if (disposed || !player) return
          video = player.video || player.querySelector('video')

          if (!video) {
            bindTimer = window.setTimeout(bindVideo, 40)
            return
          }

          video.controls = false
          video.muted = true
          video.autoplay = true
          video.playsInline = true
          video.style.objectFit = fit
          video.style.objectPosition = position

          const markLive = () => {
            if (!disposed) setPhase('live')
          }
          const markOffline = () => {
            if (!disposed) setPhase('offline')
          }

          video.addEventListener('loadeddata', markLive)
          video.addEventListener('playing', markLive)
          video.addEventListener('error', markOffline)
          cleanups.push(() => {
            video?.removeEventListener('loadeddata', markLive)
            video?.removeEventListener('playing', markLive)
            video?.removeEventListener('error', markOffline)
          })

          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markLive()
        }

        bindVideo()
      })
      .catch(() => {
        if (!disposed) setPhase('offline')
      })

    return () => {
      disposed = true
      window.clearTimeout(timeout)
      window.clearTimeout(bindTimer)
      cleanups.forEach((cleanup) => cleanup())
      player?.remove()
      if (mountRef.current === mount) mount.replaceChildren()
    }
  }, [active, reloadNonce, fit, position])

  const reload = () => {
    setPhase('connecting')
    setReloadNonce((n) => n + 1)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-[16px] bg-black"
      style={{
        '--field-camera-fit': fit,
        '--field-camera-position': position,
      } as CSSProperties}
    >
      <div ref={mountRef} className="absolute inset-0 bg-black" aria-label="Cayley field camera live stream" />

      {phase === 'connecting' && <FeedShimmer label="opening live stream..." isLight={isLight} />}
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
      {phase === 'live' && <CameraSpecsOverlay data={overlay} />}

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
        .field-camera-player,
        .field-camera-player video-stream,
        .field-camera-player video {
          width: 100% !important;
          height: 100% !important;
        }
        .field-camera-player video {
          display: block !important;
          object-fit: var(--field-camera-fit, contain) !important;
          object-position: var(--field-camera-position, center center) !important;
          background: #000 !important;
        }
        .field-camera-player .info {
          display: none !important;
        }
      `}</style>
    </div>
  )
}

function useCameraHealthOverlay(): CameraHealthOverlay {
  const [overlay, setOverlay] = useState<CameraHealthOverlay>({})

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const next: CameraHealthOverlay = {}

      try {
        const healthRes = await fetch('/api/v3/health', { cache: 'no-store' })
        if (healthRes.ok) {
          const health = (await healthRes.json()) as HealthPayload
          const media = health.system?.media_graph
          next.outputSize = media?.output_size
          next.cameraState = media?.working
            ? media.visual_quality === 'calibrated'
              ? 'calibrated'
              : media.state || 'working'
            : media?.state
          next.performanceScore = health.system?.performance?.score
          next.tempC = health.system?.cpu_temp_c
        }
      } catch {
        // Overlay is informational only; never affect video playback.
      }

      try {
        const solarRes = await fetch('/api/v3/solar', { cache: 'no-store' })
        if (solarRes.ok) {
          const solar = (await solarRes.json()) as SolarPayload
          if (solar.live !== false && solar.stale !== true) {
            next.solarPower = solar.solar_power
            next.batteryVoltage = solar.battery_voltage
          }
        }
      } catch {
        // Same as health: keep the last known render quiet on fetch failure.
      }

      if (!cancelled) {
        setOverlay(next)
        timer = setTimeout(tick, 20_000)
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return overlay
}

function CameraSpecsOverlay({ data }: { data: CameraHealthOverlay }) {
  const output = data.outputSize || '704x576'
  const score = typeof data.performanceScore === 'number' ? `${Math.round(data.performanceScore)}/100` : null
  const temp = typeof data.tempC === 'number' ? `${Math.round(data.tempC)}°C` : null
  const solar = typeof data.solarPower === 'number' ? `${Math.round(data.solarPower)}W` : null
  const battery = typeof data.batteryVoltage === 'number' ? `${data.batteryVoltage.toFixed(2)}V` : null
  const camera = data.cameraState || 'calibrated'

  return (
    <div
      className="pointer-events-none absolute top-3 right-3 hidden sm:flex flex-col items-end gap-1 text-[9px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: '#fff' }}
    >
      <div
        className="px-2.5 py-1 rounded-full"
        style={{
          background: 'rgba(0,0,0,0.58)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {output} · {ENCODER_FPS}fps · {ENCODER_CODEC} · {ENCODER_MAX_KBPS}kbps
      </div>
      <div
        className="px-2.5 py-1 rounded-full opacity-80"
        style={{
          background: 'rgba(0,0,0,0.46)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {camera}
        {score && ` · score ${score}`}
        {temp && ` · ${temp}`}
      </div>
      {(solar || battery) && (
        <div
          className="px-2.5 py-1 rounded-full opacity-75"
          style={{
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {[solar, battery].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}

function loadVideoStreamScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser unavailable'))
  if (window.customElements.get('video-stream')) return Promise.resolve()
  if (window.__cayleyVideoStreamScript) return window.__cayleyVideoStreamScript

  window.__cayleyVideoStreamScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.crossOrigin = 'anonymous'
    script.src = `${CAMERA_HOST}/video-stream.js`
    script.onload = () => {
      window.customElements.whenDefined('video-stream').then(() => resolve(), reject)
    }
    script.onerror = () => {
      window.__cayleyVideoStreamScript = undefined
      reject(new Error('go2rtc player script failed to load'))
    }
    document.head.appendChild(script)
  })

  return window.__cayleyVideoStreamScript
}

function playerWsUrl(reloadNonce: number): URL {
  const url = new URL('/api/ws', CAMERA_HOST)
  url.searchParams.set('src', FEED_STREAM)
  url.searchParams.set('_', String(reloadNonce))
  return url
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
      <div>mode:direct {PLAYER_MODE}</div>
      <div>phase:{phase}</div>
    </div>
  )
}
