'use client'

/**
 * FieldCameraFeed renders the relay-sanitized camera surface by default.
 *
 * The raw go2rtc/WebRTC path remains available through the native link, but
 * the embedded website feed intentionally uses the relay's clean MJPEG/JPEG
 * output so damaged H.264 frames from the board do not reach normal visitors.
 */

import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react'
import {
  CAMERA_HOST,
  MJPEG_URL,
  PLAYER_MODE,
  PRIMARY_FEED_STREAM,
  QUALITY_URL,
  SNAPSHOT_URL,
} from '@/lib/fieldCameraConfig'
import { useFieldTheme } from './fieldTheme'

const DETECTION_WINDOW_SEC = 60
const DETECTIONS_URL = `/api/v3/detections?window_sec=${DETECTION_WINDOW_SEC}`
const SNAPSHOT_REFRESH_MS = 4_000
const MJPEG_START_TIMEOUT_MS = 8_000
const STALE_CLEAN_FRAME_SEC = 10

type Phase = 'paused' | 'connecting' | 'preview' | 'live' | 'offline'
type VideoFit = 'contain' | 'cover' | 'fill'

type VideoOverlayLayout = {
  left: number
  top: number
  width: number
  height: number
}

type CameraQuality = {
  ok?: boolean
  mode?: string
  snapshot?: {
    source?: string | null
    age_s?: number | null
    stale?: boolean
  }
  sanitizer?: {
    frames_seen?: number
    frames_written?: number
    frames_dropped_green?: number
    frames_dropped_encode?: number
    decoder_errors?: number
    ffmpeg_restarts?: number
    fps_target?: number
    width?: number
    height?: number
    latest_clean_age_s?: number | null
    latest_seen_age_s?: number | null
    last_green_ratio?: number | null
  }
  rknn_frame?: {
    source?: string | null
    age_s?: number | null
    stale?: boolean
  }
  error?: string
}

type CameraHealthOverlay = {
  outputSize?: string
  profile?: CameraStreamProfile
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<boolean>(() => enabled && initialActive())
  const [phase, setPhase] = useState<Phase>(() => (enabled && initialActive() ? 'connecting' : 'paused'))
  const [snapshotNonce, setSnapshotNonce] = useState(0)
  const [streamNonce, setStreamNonce] = useState(0)
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [streamReady, setStreamReady] = useState(false)
  const debugMode = useDebugFlag()
  const overlay = useCameraHealthOverlay(active)
  const detections = useDetectionOverlay(active)
  const quality = useCameraQuality(active)
  const mediaWidth = overlay.profile?.width || 1280
  const mediaHeight = overlay.profile?.height || 960
  const videoLayout = useOverlayLayout(containerRef, fit, position, mediaWidth, mediaHeight)
  const snapshotUrl = `${SNAPSHOT_URL}?v=${snapshotNonce}`
  const mjpegUrl = `${MJPEG_URL}?v=${streamNonce}`
  const mediaHealthBad = isConfirmedCameraBad(quality)
  const showStream = active && !mediaHealthBad

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
        { threshold: 0, rootMargin: '320px 0px' }
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
      setSnapshotReady(false)
      setStreamReady(false)
      return
    }

    setPhase('connecting')
    setSnapshotReady(false)
    setStreamReady(false)
    setStreamNonce((n) => n + 1)
    setSnapshotNonce(Date.now())
    const timeout = window.setTimeout(() => {
      setPhase((p) => (p === 'connecting' ? 'offline' : p))
    }, MJPEG_START_TIMEOUT_MS)
    const refresh = window.setInterval(() => setSnapshotNonce(Date.now()), SNAPSHOT_REFRESH_MS)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(refresh)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    if (mediaHealthBad) {
      setPhase((p) => (p === 'live' || p === 'preview' || p === 'connecting' ? 'offline' : p))
      return
    }
    if (snapshotReady) {
      setPhase((p) => (p === 'connecting' || p === 'offline' ? 'preview' : p))
    }
  }, [active, mediaHealthBad, snapshotReady])

  const reload = () => {
    setPhase('connecting')
    setSnapshotReady(false)
    setStreamReady(false)
    setStreamNonce((n) => n + 1)
    setSnapshotNonce(Date.now())
  }

  const streamActive = streamReady && phase === 'live'

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-[16px] bg-black"
      style={{
        '--field-camera-fit': fit,
        '--field-camera-position': position,
      } as CSSProperties}
    >
      <img
        src={snapshotUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 h-full w-full"
        onLoad={() => {
          setSnapshotReady(true)
          setPhase((p) => (active && !mediaHealthBad && (p === 'connecting' || p === 'offline') ? 'preview' : p))
        }}
        onError={() => {
          setSnapshotReady(false)
          setPhase((p) => (p === 'live' && streamReady ? p : 'offline'))
        }}
        style={{
          objectFit: fit,
          objectPosition: position,
          opacity: streamActive ? 0 : 1,
          transition: 'opacity 240ms ease',
          filter: phase === 'offline' ? 'saturate(0.84) brightness(0.7)' : 'saturate(1.02) contrast(1.03)',
        }}
      />

      {showStream && (
        <img
          key={streamNonce}
          src={mjpegUrl}
          alt=""
          aria-label="Cayley field camera clean live preview"
          className="absolute inset-0 h-full w-full"
          onLoad={() => {
            setSnapshotReady(true)
            setStreamReady(true)
            setPhase('live')
          }}
          onError={() => {
            setStreamReady(false)
            setPhase((p) => (snapshotReady && !mediaHealthBad ? 'preview' : 'offline'))
          }}
          style={{
            objectFit: fit,
            objectPosition: position,
            opacity: streamActive ? 1 : 0,
            transition: 'opacity 240ms ease',
          }}
        />
      )}

      {phase === 'connecting' && !snapshotReady && <FeedShimmer label="opening clean preview..." isLight={isLight} />}
      {phase === 'paused' && <FeedPaused />}
      {phase === 'offline' && <FeedOffline isLight={isLight} onRetry={reload} />}

      {(phase === 'preview' || phase === 'live') && <LiveBadge phase={phase} quality={quality} />}
      {(phase === 'preview' || phase === 'live') && <CameraSpecsOverlay data={overlay} quality={quality} />}
      {phase === 'live' && <DetectionOverlay data={detections} layout={videoLayout} />}
      {debugMode && <DevHUD phase={phase} quality={quality} />}

      <a
        href={nativePlayerUrl(PRIMARY_FEED_STREAM)}
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

export function prewarmFieldCameraFeed() {
  if (typeof window === 'undefined') return
  const image = new Image()
  image.decoding = 'async'
  image.src = `${SNAPSHOT_URL}?v=${Date.now()}`
  fetch(QUALITY_URL, { cache: 'no-store' }).catch(() => undefined)
}

function isConfirmedCameraBad(quality: CameraQuality): boolean {
  if (quality.snapshot?.stale === true) return true
  if (typeof quality.sanitizer?.latest_clean_age_s === 'number' && quality.sanitizer.latest_clean_age_s > STALE_CLEAN_FRAME_SEC) {
    return true
  }
  return quality.ok === false && !quality.error
}

function useCameraQuality(enabled: boolean): CameraQuality {
  const [quality, setQuality] = useState<CameraQuality>({})

  useEffect(() => {
    if (!enabled) {
      setQuality({})
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const res = await fetch(QUALITY_URL, { cache: 'no-store' })
        if (res.ok) {
          const next = (await res.json()) as CameraQuality
          if (!cancelled) setQuality(next)
        } else if (!cancelled) {
          setQuality({ ok: false, error: `quality_${res.status}` })
        }
      } catch {
        if (!cancelled) setQuality({ ok: false, error: 'quality_unreachable' })
      }
      if (!cancelled) timer = setTimeout(tick, 2_000)
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled])

  return quality
}

function useCameraHealthOverlay(enabled: boolean): CameraHealthOverlay {
  const [overlay, setOverlay] = useState<CameraHealthOverlay>({})

  useEffect(() => {
    if (!enabled) {
      setOverlay({})
      return
    }

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
        // Overlay is informational only.
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
  }, [enabled])

  return overlay
}

function useDetectionOverlay(enabled: boolean): DetectionPayload {
  const [data, setData] = useState<DetectionPayload>({})

  useEffect(() => {
    if (!enabled) {
      setData({})
      return
    }

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
  }, [enabled])

  return data
}

function useOverlayLayout(
  ref: RefObject<HTMLDivElement | null>,
  fit: VideoFit,
  position: string,
  mediaWidth: number,
  mediaHeight: number,
): VideoOverlayLayout | null {
  const [layout, setLayout] = useState<VideoOverlayLayout | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setLayout(computeVideoOverlayLayout({
        containerWidth: el.clientWidth,
        containerHeight: el.clientHeight,
        mediaWidth,
        mediaHeight,
        fit,
        position,
      }))
    }
    update()
    window.addEventListener('resize', update)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update)
      ro.observe(el)
    }
    return () => {
      window.removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [fit, mediaHeight, mediaWidth, position, ref])

  return layout
}

function LiveBadge({ phase, quality }: { phase: Extract<Phase, 'preview' | 'live'>; quality: CameraQuality }) {
  const dropped = quality.sanitizer?.frames_dropped_green ?? 0
  const label = phase === 'live' ? 'Clean live' : 'Clean preview'
  return (
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
          background: '#34d399',
          boxShadow: '0 0 6px #34d399',
          animation: 'fldLivePulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
        }}
      />
      {label}{dropped > 0 ? ` · ${dropped} drops` : ''}
    </div>
  )
}

function CameraSpecsOverlay({ data, quality }: { data: CameraHealthOverlay; quality: CameraQuality }) {
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
  const cleanAge = typeof quality.sanitizer?.latest_clean_age_s === 'number'
    ? `${quality.sanitizer.latest_clean_age_s.toFixed(1)}s clean`
    : null
  const cleanOutput = quality.sanitizer?.width && quality.sanitizer?.height
    ? `${quality.sanitizer.width}x${quality.sanitizer.height}`
    : null
  const cleanFps = typeof quality.sanitizer?.fps_target === 'number' && quality.sanitizer.fps_target > 0
    ? `${formatFps(quality.sanitizer.fps_target)}fps`
    : null
  const cleanDrops = (quality.sanitizer?.frames_dropped_green ?? 0) + (quality.sanitizer?.frames_dropped_encode ?? 0)
  const cleanRestart = quality.sanitizer?.ffmpeg_restarts && quality.sanitizer.ffmpeg_restarts > 1
    ? `${quality.sanitizer.ffmpeg_restarts} restarts`
    : null
  const cleanParts = [
    cleanOutput,
    cleanFps,
    quality.mode === 'sanitized-preview' || quality.snapshot?.source === 'sanitized' ? 'sanitized' : null,
    cleanDrops > 0 ? `${cleanDrops} drops` : null,
    cleanRestart,
    cleanAge,
  ].filter(Boolean)
  if (cleanParts.length > 0) {
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
          {cleanParts.join(' · ')}
        </div>
      </div>
    )
  }

  const parts = [
    output,
    fps,
    codec,
    mbps != null ? `${mbps.toFixed(1)} Mbps` : null,
    cleanAge,
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
      : 'scanning'
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

function FeedShimmer({ label, isLight }: { label: string; isLight: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: isLight
          ? 'linear-gradient(105deg, rgba(236,236,239,0.42) 25%, rgba(246,246,248,0.55) 50%, rgba(236,236,239,0.42) 75%)'
          : 'linear-gradient(105deg, rgba(10,10,12,0.34) 25%, rgba(22,22,26,0.48) 50%, rgba(10,10,12,0.34) 75%)',
        backgroundSize: '200% 100%',
        animation: 'fldShimmer 2.4s linear infinite',
        backdropFilter: 'blur(1px)',
        WebkitBackdropFilter: 'blur(1px)',
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <CameraGlyph isLight={isLight} />
        <div
          className="text-[11px] uppercase tracking-[0.2em] font-medium"
          style={{ color: isLight ? 'rgba(0,0,0,0.48)' : 'rgba(255,255,255,0.58)' }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

function FeedPaused() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/60">paused</div>
    </div>
  )
}

function FeedOffline({ isLight, onRetry }: { isLight: boolean; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/62 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <CameraGlyph dim isLight={isLight} />
        <div className="text-[11px] uppercase tracking-[0.2em] font-medium text-white/70">
          clean preview recovering
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 transition hover:text-white"
          style={{ background: 'rgba(255,255,255,0.12)' }}
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

function DevHUD({ phase, quality }: { phase: Phase; quality: CameraQuality }) {
  const rknnAge = typeof quality.rknn_frame?.age_s === 'number'
    ? quality.rknn_frame.age_s.toFixed(1)
    : 'n/a'
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
      <div>tier:relay-sanitized</div>
      <div>phase:{phase}</div>
      <div>ok:{String(quality.ok ?? 'pending')}</div>
      <div>drops:{quality.sanitizer?.frames_dropped_green ?? 0}</div>
      <div>decode:{quality.sanitizer?.decoder_errors ?? 0}</div>
      <div>rknn:{quality.rknn_frame?.source ?? 'n/a'} {rknnAge}s</div>
    </div>
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

function formatFps(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatDetectionAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${Math.round(seconds / 60)}m`
}

function nativePlayerUrl(stream: string): string {
  return `${CAMERA_HOST}/stream.html` +
    `?src=${encodeURIComponent(stream)}` +
    `&mode=${encodeURIComponent(PLAYER_MODE)}` +
    '&background=false' +
    '&width=100%'
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
