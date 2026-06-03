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
 * full relay-facing camera frame visible inside responsive cards.
 */

import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const CAMERA_HOST =
  process.env.NEXT_PUBLIC_V3_CAMERA_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'
const PRIMARY_FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
const FEED_STREAMS = uniqueStreamNames([PRIMARY_FEED_STREAM, 'cayley-sub'])
const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'webrtc,mse,mjpeg'
const PLAYER_ASSET_VERSION = '20260603-green-band-recovery'

const SNAPSHOT_URL = `${CAMERA_HOST}/api/camera/snapshot.jpeg`
const DETECTION_WINDOW_SEC = 60
const DETECTIONS_URL = `/api/v3/detections?window_sec=${DETECTION_WINDOW_SEC}`

const LOAD_TIMEOUT_MS = 10_000
const FRAME_INSPECTION_INTERVAL_MS = 1_500
const GREEN_BAND_TRIGGER_COUNT = 2
const GREEN_BAND_RECOVERY_COOLDOWN_MS = 12_000

type Phase = 'paused' | 'connecting' | 'live' | 'offline'
type VideoFit = 'contain' | 'cover' | 'fill'

type VideoOverlayLayout = {
  left: number
  top: number
  width: number
  height: number
}

type BandStats = {
  avgR: number
  avgG: number
  avgB: number
  greenRatio: number
}

type CameraHealthOverlay = {
  outputSize?: string
  profile?: CameraStreamProfile
}

type DetectionItem = {
  ts?: number
  class?: string
  conf?: number
  bbox?: {
    x?: number
    y?: number
    w?: number
    h?: number
  }
}

type DetectionPayload = {
  now?: number
  counts?: Record<string, number>
  recent?: DetectionItem[]
  error?: string
}

type CameraStreamProfile = {
  output_size?: string
  width?: number
  height?: number
  fps?: number
  source_fps?: number
  codec?: string
  profile?: string
  bitrate_kbps?: number
  bitrate_mbps?: number
  gop?: number
  rc_mode?: string
}

type HealthPayload = {
  system?: {
    media_graph?: {
      output_size?: string
      stream_profile?: CameraStreamProfile
    }
  }
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
  const detections = useDetectionOverlay()
  const containerRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const lastVisualRecoveryAtRef = useRef(0)

  const [active, setActive] = useState<boolean>(() => enabled && initialActive())
  const [phase, setPhase] = useState<Phase>(() => (enabled && initialActive() ? 'connecting' : 'paused'))
  const [reloadNonce, setReloadNonce] = useState(0)
  const [streamIndex, setStreamIndex] = useState(0)
  const [videoLayout, setVideoLayout] = useState<VideoOverlayLayout | null>(null)
  const activeStream = FEED_STREAMS[streamIndex] ?? FEED_STREAMS[0]
  const snapshotUrl = `${SNAPSHOT_URL}?v=${reloadNonce}`

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
    let loadTimer = 0
    let frameInspectionTimer = 0
    let greenBandHits = 0
    let reachedLive = false
    let resizeObserver: ResizeObserver | null = null
    const cleanups: Array<() => void> = []

    setPhase('connecting')
    setVideoLayout(null)
    mount.replaceChildren()

    const markPlaybackFailure = (timeoutOnly = false) => {
      if (disposed || (timeoutOnly && reachedLive)) return
      if (streamIndex < FEED_STREAMS.length - 1) {
        setPhase('connecting')
        setStreamIndex(streamIndex + 1)
        setReloadNonce((n) => n + 1)
        return
      }
      setPhase('offline')
    }

    loadTimer = window.setTimeout(() => markPlaybackFailure(true), LOAD_TIMEOUT_MS)

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
        player.src = playerWsUrl(activeStream, reloadNonce)

        const bindVideo = () => {
          if (disposed || !player) return
          video = player.video || player.querySelector('video')

          if (!video) {
            bindTimer = window.setTimeout(bindVideo, 40)
            return
          }

          video.controls = false
          video.crossOrigin = 'anonymous'
          video.muted = true
          video.autoplay = true
          video.playsInline = true
          video.style.objectFit = fit
          video.style.objectPosition = position

          const updateVideoLayout = () => {
            const container = containerRef.current
            if (!container || !video) return
            const containerWidth = container.clientWidth
            const containerHeight = container.clientHeight
            const mediaWidth = video.videoWidth || 1280
            const mediaHeight = video.videoHeight || 720
            setVideoLayout(computeVideoOverlayLayout({
              containerWidth,
              containerHeight,
              mediaWidth,
              mediaHeight,
              fit,
              position,
            }))
          }

          const markLive = () => {
            if (!disposed) {
              reachedLive = true
              window.clearTimeout(loadTimer)
              setPhase('live')
              updateVideoLayout()
            }
          }
          const markOffline = () => markPlaybackFailure()
          const inspectFrame = () => {
            if (disposed || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

            const greenBand = detectGreenDecoderBand(video)
            if (greenBand === 'unsupported') {
              window.clearInterval(frameInspectionTimer)
              frameInspectionTimer = 0
              return
            }

            greenBandHits = greenBand ? greenBandHits + 1 : 0
            const now = Date.now()
            if (
              greenBandHits >= GREEN_BAND_TRIGGER_COUNT &&
              now - lastVisualRecoveryAtRef.current > GREEN_BAND_RECOVERY_COOLDOWN_MS
            ) {
              lastVisualRecoveryAtRef.current = now
              greenBandHits = 0
              reachedLive = false
              setPhase('connecting')
              setStreamIndex(0)
              setReloadNonce((n) => n + 1)
            }
          }

          video.addEventListener('loadedmetadata', markLive)
          video.addEventListener('loadeddata', markLive)
          video.addEventListener('canplay', markLive)
          video.addEventListener('playing', markLive)
          video.addEventListener('timeupdate', markLive)
          video.addEventListener('error', markOffline)
          video.addEventListener('loadedmetadata', updateVideoLayout)
          window.addEventListener('resize', updateVideoLayout)
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(updateVideoLayout)
            resizeObserver.observe(containerRef.current ?? mount)
          }
          frameInspectionTimer = window.setInterval(inspectFrame, FRAME_INSPECTION_INTERVAL_MS)
          cleanups.push(() => {
            video?.removeEventListener('loadedmetadata', markLive)
            video?.removeEventListener('loadeddata', markLive)
            video?.removeEventListener('canplay', markLive)
            video?.removeEventListener('playing', markLive)
            video?.removeEventListener('timeupdate', markLive)
            video?.removeEventListener('error', markOffline)
            video?.removeEventListener('loadedmetadata', updateVideoLayout)
            window.removeEventListener('resize', updateVideoLayout)
            resizeObserver?.disconnect()
            if (frameInspectionTimer) window.clearInterval(frameInspectionTimer)
          })

          updateVideoLayout()
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markLive()
        }

        bindVideo()
      })
      .catch(() => {
        markPlaybackFailure()
      })

    return () => {
      disposed = true
      window.clearTimeout(loadTimer)
      window.clearTimeout(bindTimer)
      cleanups.forEach((cleanup) => cleanup())
      setVideoLayout(null)
      player?.remove()
      if (mountRef.current === mount) mount.replaceChildren()
    }
  }, [active, activeStream, streamIndex, reloadNonce, fit, position])

  useEffect(() => {
    if (!active || phase !== 'offline') return

    const retryTimer = window.setTimeout(() => {
      setPhase('connecting')
      setStreamIndex(0)
      setReloadNonce((n) => n + 1)
    }, 8_000)

    return () => window.clearTimeout(retryTimer)
  }, [active, phase])

  const reload = () => {
    setPhase('connecting')
    setStreamIndex(0)
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

      {phase !== 'live' && (
        <img
          src={snapshotUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            objectFit: fit,
            objectPosition: position,
            opacity: 0.62,
            filter: 'saturate(0.9) contrast(1.04) brightness(0.72)',
          }}
        />
      )}

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

      {debugMode && <DevHUD phase={phase} stream={activeStream} />}
      {phase === 'live' && <CameraSpecsOverlay data={overlay} />}
      {phase === 'live' && <DetectionOverlay data={detections} layout={videoLayout} />}

      <a
        href={nativePlayerUrl(activeStream)}
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
          next.profile = media?.stream_profile
        }
      } catch {
        // Overlay is informational only; never affect video playback.
      }

      if (!cancelled) {
        setOverlay(next)
        timer = setTimeout(tick, 10_000)
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

function useDetectionOverlay(): DetectionPayload {
  const [data, setData] = useState<DetectionPayload>({})

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const res = await fetch(DETECTIONS_URL, { cache: 'no-store' })
        if (res.ok) {
          const next = (await res.json()) as DetectionPayload
          if (!cancelled) setData(next)
        }
      } catch {
        if (!cancelled) setData((prev) => ({ ...prev, error: 'unreachable' }))
      }
      if (!cancelled) timer = setTimeout(tick, 2_000)
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return data
}

function CameraSpecsOverlay({ data }: { data: CameraHealthOverlay }) {
  const profile = data.profile
  const output = profile?.output_size ||
    (profile?.width && profile?.height ? `${profile.width}x${profile.height}` : data.outputSize)
  const fps = typeof profile?.fps === 'number' && profile.fps > 0 ? `${Math.round(profile.fps)}fps` : null
  const codec = profile?.codec || null
  const mbps = typeof profile?.bitrate_mbps === 'number' && profile.bitrate_mbps > 0
    ? profile.bitrate_mbps
    : typeof profile?.bitrate_kbps === 'number' && profile.bitrate_kbps > 0
      ? profile.bitrate_kbps / 1000
      : null
  const parts = [
    output,
    fps,
    codec,
    mbps != null ? `${mbps.toFixed(1)} Mbps` : null,
  ].filter(Boolean)

  if (parts.length === 0) return null

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
        {parts.join(' · ')}
      </div>
    </div>
  )
}

function DetectionOverlay({ data, layout }: { data: DetectionPayload; layout: VideoOverlayLayout | null }) {
  const recent = Array.isArray(data.recent) ? data.recent : []
  const now = typeof data.now === 'number' ? data.now : Date.now() / 1000
  const withAge = recent
    .filter((item) => typeof item.ts === 'number')
    .map((item) => ({ item, age: Math.max(0, now - (item.ts ?? now)) }))
    .sort((a, b) => (a.item.ts ?? 0) - (b.item.ts ?? 0))
  const latest = withAge.at(-1)
  const age = latest?.age ?? null
  const fresh = age != null && age <= 15
  const counts = data.counts ?? {}
  const total = Object.values(counts).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0)
  const latestItem = latest?.item
  const latestLabel = latestItem?.class
    ? `${displayDetectionClass(latestItem.class)}${typeof latestItem.conf === 'number' ? ` ${(latestItem.conf * 100).toFixed(0)}%` : ''}`
    : null
  const label = latestLabel
    ? fresh
      ? latestLabel
      : `${latestLabel} · ${formatDetectionAge(age ?? 0)} ago`
    : total > 0
      ? `${total} detections / ${DETECTION_WINDOW_SEC}s`
      : 'scanning 1 fps'
  const latestTs = latest?.item.ts
  const boxes = withAge
    .filter(({ item, age }) => (
      age <= 6 &&
      typeof latestTs === 'number' &&
      typeof item.ts === 'number' &&
      latestTs - item.ts <= 1 &&
      item.bbox &&
      typeof item.bbox.x === 'number' &&
      typeof item.bbox.y === 'number'
    ))
    .sort((a, b) => {
      const tsDelta = (b.item.ts ?? 0) - (a.item.ts ?? 0)
      if (Math.abs(tsDelta) > 1) return tsDelta
      return (b.item.conf ?? 0) - (a.item.conf ?? 0)
    })
    .slice(0, 4)

  const overlayStyle: CSSProperties = layout
    ? {
        left: `${layout.left}%`,
        top: `${layout.top}%`,
        width: `${layout.width}%`,
        height: `${layout.height}%`,
      }
    : { inset: 0 }

  return (
    <>
      <div className="pointer-events-none absolute" style={overlayStyle}>
      {boxes.map(({ item, age }, index) => {
        const b = item.bbox
        if (!b) return null
        const left = clamp01(b.x ?? 0) * 100
        const top = clamp01(b.y ?? 0) * 100
        const width = clamp01(b.w ?? 0) * 100
        const height = clamp01(b.h ?? 0) * 100
        const boxFresh = age <= 15
        const opacity = boxFresh ? 1 : Math.max(0.45, 1 - age / 24)
        return (
          <div
            key={`${item.ts}-${index}`}
            className="pointer-events-none absolute rounded-[6px] border"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              opacity,
              borderColor: '#34d399',
              borderStyle: boxFresh ? 'solid' : 'dashed',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.45), 0 0 16px rgba(52,211,153,0.35)',
            }}
          >
            <div
              className="absolute -top-6 left-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
              style={{ background: 'rgba(0,0,0,0.72)', color: '#bbf7d0' }}
            >
              {displayDetectionClass(item.class)}{typeof item.conf === 'number' ? ` ${(item.conf * 100).toFixed(0)}%` : ''}{boxFresh ? '' : ` · ${formatDetectionAge(age)}`}
            </div>
          </div>
        )
      })}
      </div>
      <div
        className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]"
        style={{
          background: latestItem ? 'rgba(6, 78, 59, 0.72)' : 'rgba(0,0,0,0.58)',
          color: latestItem ? '#bbf7d0' : 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: latestItem ? '#34d399' : '#8e8e93',
            boxShadow: latestItem ? '0 0 8px rgba(52,211,153,0.8)' : undefined,
          }}
        />
        RKNN · {label}
      </div>
    </>
  )
}

function computeVideoOverlayLayout({
  containerWidth,
  containerHeight,
  mediaWidth,
  mediaHeight,
  fit,
  position,
}: {
  containerWidth: number
  containerHeight: number
  mediaWidth: number
  mediaHeight: number
  fit: VideoFit
  position: string
}): VideoOverlayLayout {
  if (containerWidth <= 0 || containerHeight <= 0 || mediaWidth <= 0 || mediaHeight <= 0 || fit === 'fill') {
    return { left: 0, top: 0, width: 100, height: 100 }
  }

  const scale = fit === 'cover'
    ? Math.max(containerWidth / mediaWidth, containerHeight / mediaHeight)
    : Math.min(containerWidth / mediaWidth, containerHeight / mediaHeight)
  const renderedWidth = mediaWidth * scale
  const renderedHeight = mediaHeight * scale
  const [xAlign, yAlign] = parseObjectPosition(position)
  const leftPx = (containerWidth - renderedWidth) * xAlign
  const topPx = (containerHeight - renderedHeight) * yAlign

  return {
    left: (leftPx / containerWidth) * 100,
    top: (topPx / containerHeight) * 100,
    width: (renderedWidth / containerWidth) * 100,
    height: (renderedHeight / containerHeight) * 100,
  }
}

function parseObjectPosition(position: string): [number, number] {
  const tokens = position.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const xToken = tokens[0] ?? 'center'
  const yToken = tokens[1] ?? (isVerticalPositionToken(xToken) ? xToken : 'center')

  return [positionTokenToRatio(xToken, 'x'), positionTokenToRatio(yToken, 'y')]
}

function isVerticalPositionToken(token: string): boolean {
  return token === 'top' || token === 'bottom'
}

function positionTokenToRatio(token: string, axis: 'x' | 'y'): number {
  if (token.endsWith('%')) {
    const parsed = Number.parseFloat(token)
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed / 100))
  }
  if (axis === 'x') {
    if (token === 'left') return 0
    if (token === 'right') return 1
  }
  if (axis === 'y') {
    if (token === 'top') return 0
    if (token === 'bottom') return 1
  }
  return 0.5
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function detectGreenDecoderBand(video: HTMLVideoElement): boolean | 'unsupported' {
  if (typeof document === 'undefined' || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return false
  }

  const width = 96
  const height = 72
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 'unsupported'

  try {
    ctx.drawImage(video, 0, 0, width, height)
    const data = ctx.getImageData(0, 0, width, height).data
    const top = bandStats(data, width, 0, 12)
    const middle = bandStats(data, width, 31, 43)
    const bottom = bandStats(data, width, 54, height)

    return (
      bottom.greenRatio > 0.32 &&
      bottom.greenRatio > Math.max(top.greenRatio * 2.5, middle.greenRatio * 2.5, 0.32) &&
      bottom.avgG > 72 &&
      bottom.avgR < 58 &&
      bottom.avgB < 58 &&
      bottom.avgG > bottom.avgR * 1.9 &&
      bottom.avgG > bottom.avgB * 1.45
    )
  } catch {
    return 'unsupported'
  }
}

function bandStats(data: Uint8ClampedArray, width: number, startY: number, endY: number): BandStats {
  let rTotal = 0
  let gTotal = 0
  let bTotal = 0
  let green = 0
  let count = 0

  for (let y = startY; y < endY; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const r = data[offset] ?? 0
      const g = data[offset + 1] ?? 0
      const b = data[offset + 2] ?? 0
      rTotal += r
      gTotal += g
      bTotal += b
      count += 1

      if (g >= 72 && r <= 54 && b <= 54 && g >= r * 2.1 && g >= b * 1.8) {
        green += 1
      }
    }
  }

  return {
    avgR: count ? rTotal / count : 0,
    avgG: count ? gTotal / count : 0,
    avgB: count ? bTotal / count : 0,
    greenRatio: count ? green / count : 0,
  }
}

function displayDetectionClass(value?: string): string {
  switch (value) {
    case 'tv':
      return 'monitor'
    case 'cell phone':
      return 'phone'
    case 'potted plant':
      return 'plant'
    default:
      return value || 'object'
  }
}

function formatDetectionAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${Math.round(seconds / 60)}m`
}

function loadVideoStreamScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser unavailable'))
  if (window.customElements.get('video-stream')) return Promise.resolve()
  if (window.__cayleyVideoStreamScript) return window.__cayleyVideoStreamScript

  window.__cayleyVideoStreamScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.crossOrigin = 'anonymous'
    script.src = `${CAMERA_HOST}/video-stream.js?v=${PLAYER_ASSET_VERSION}`
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

function playerWsUrl(stream: string, reloadNonce: number): URL {
  const url = new URL('/api/ws', CAMERA_HOST)
  url.searchParams.set('src', stream)
  url.searchParams.set('_', String(reloadNonce))
  return url
}

function nativePlayerUrl(stream: string): string {
  return `${CAMERA_HOST}/stream.html` +
    `?src=${encodeURIComponent(stream)}` +
    `&mode=${encodeURIComponent(PLAYER_MODE)}` +
    '&background=false' +
    '&width=100%'
}

function uniqueStreamNames(names: string[]): string[] {
  const seen = new Set<string>()
  return names
    .map((name) => name.trim())
    .filter((name) => {
      if (!name || seen.has(name)) return false
      seen.add(name)
      return true
    })
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
          ? 'linear-gradient(105deg, rgba(236,236,239,0.72) 25%, rgba(246,246,248,0.86) 50%, rgba(236,236,239,0.72) 75%)'
          : 'linear-gradient(105deg, rgba(10,10,12,0.66) 25%, rgba(22,22,26,0.78) 50%, rgba(10,10,12,0.66) 75%)',
        backgroundSize: '200% 100%',
        animation: 'fldShimmer 2.4s linear infinite',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
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
      style={{ background: 'rgba(0,0,0,0.58)' }}
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
      style={{
        background: isLight ? 'rgba(241,241,243,0.82)' : 'rgba(5,5,6,0.78)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
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

function DevHUD({ phase, stream }: { phase: Phase; stream: string }) {
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
      <div>stream:{stream}</div>
      <div>phase:{phase}</div>
    </div>
  )
}
