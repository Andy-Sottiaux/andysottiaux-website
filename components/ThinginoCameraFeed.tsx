'use client'

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CAMERA_FALLBACK_MEDIA_ENABLED,
  CAMERA_2_CONTROL_FALLBACK_URL,
  CAMERA_2_CONTROL_URL,
  CAMERA_2_CONTROL_WS_FALLBACK_URL,
  CAMERA_2_CONTROL_WS_URL,
  CAMERA_2_MJPEG_URL,
  CAMERA_2_NATIVE_URL,
  CAMERA_2_SNAPSHOT_URL,
  CAMERA_2_SETTINGS_FALLBACK_URL,
  CAMERA_2_SETTINGS_URL,
  CAMERA_2_STREAM,
  CAMERA_2_STATUS_URL,
  CAMERA_2_URL,
  CAMERA_2_WEBRTC_FALLBACK_OFFER_URL,
  CAMERA_2_WEBRTC_FALLBACK_SOURCE_PARAM,
  CAMERA_2_WEBRTC_OFFER_URL,
  CAMERA_2_WEBRTC_SOURCE_PARAM,
  CAMERA_HOST,
  PLAYER_MODE,
} from '@/lib/fieldCameraConfig'
import { useFieldTheme } from './fieldTheme'

type VideoFit = 'contain' | 'cover' | 'fill'
type Cam2Status = {
  ok?: boolean
  error?: string
  upstream_status?: number
  motion?: Cam2MotionState
}
type Cam2Settings = {
  ok?: boolean
  stream0?: {
    width?: number
    height?: number
    fps?: number
    bitrate?: number
    gop?: number
    max_gop?: number
    format?: string
    mode?: string
    profile?: number
  } | null
  motor?: {
    steps_pan?: number
    steps_tilt?: number
    accel_pan?: number
    accel_tilt?: number
    motion_driver?: string
    preview_control_mode?: string
  } | null
}
type Cam2Command = 'ul' | 'uc' | 'ur' | 'cl' | 'center' | 'cr' | 'dl' | 'dc' | 'dr' | 'home' | 'stop'
type Cam2MotionState = {
  active?: boolean
  command?: string | null
  vector?: { x?: number; y?: number; speed?: number }
  interval_ms?: number
  ttl_ms?: number
}
type Cam2PlaybackMetrics = {
  readyState: number
  videoWidth: number
  videoHeight: number
  currentTime: number
  totalVideoFrames?: number | null
  droppedVideoFrames?: number | null
  corruptedVideoFrames?: number | null
  rtcConnectionState?: RTCPeerConnectionState
  rtcIceConnectionState?: RTCIceConnectionState
  rtcFramesPerSecond?: number | null
  rtcFramesDecoded?: number | null
  rtcFramesDropped?: number | null
  rtcBytesReceived?: number | null
  rtcJitterSec?: number | null
  rtcPacketsLost?: number | null
  rtcPacketsReceived?: number | null
  rtcCurrentRoundTripTimeSec?: number | null
  selectedRemoteType?: string | null
  selectedRemoteProtocol?: string | null
}
type ControlPayload = {
  command?: Cam2Command
  direction?: Cam2Command
  action?: 'move' | 'stop' | 'hold'
  x?: number
  y?: number
  speed?: number
  step?: 'fine' | 'normal' | 'coarse'
  hold?: boolean
}

function cam2StatusCopy(status: Cam2Status | null) {
  if (!status) return 'Checking relay and camera status...'
  if (status.ok) return 'Relay auth works. Retrying the stream may restore the preview.'
  if (status.error === 'camera_unreachable' || status.error === 'login_timeout') {
    return 'Relay is online, but the camera is not answering on the LAN.'
  }
  if (status.error === 'login_status' && status.upstream_status === 502) {
    return 'Relay reached the camera path, but the upstream returned an error.'
  }
  if (status.error === 'auth_unavailable') {
    return 'Relay is online, but Thingino did not return a session cookie.'
  }
  return 'Cam 2 is not returning video right now.'
}

export default function ThinginoCameraFeed({
  fit = 'contain',
  position = 'center center',
}: {
  fit?: VideoFit
  position?: string
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const [streamVersion, setStreamVersion] = useState(0)
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerFailed, setPlayerFailed] = useState(false)
  const [streamReady, setStreamReady] = useState(false)
  const [streamFailed, setStreamFailed] = useState(false)
  const [status, setStatus] = useState<Cam2Status | null>(null)
  const [settings, setSettings] = useState<Cam2Settings | null>(null)
  const [controlPending, setControlPending] = useState<Cam2Command | null>(null)
  const [controlConnected, setControlConnected] = useState(false)
  const [motionState, setMotionState] = useState<Cam2MotionState | null>(null)
  const [playbackMetrics, setPlaybackMetrics] = useState<Cam2PlaybackMetrics | null>(null)
  const [qualityPending, setQualityPending] = useState<string | null>(null)
  const rtcVideoRef = useRef<HTMLVideoElement>(null)
  const controlWsRef = useRef<WebSocket | null>(null)
  const controlWsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlBusyRef = useRef(false)
  const mjpegUrl = `${CAMERA_2_MJPEG_URL}?v=${streamVersion}`
  const snapshotUrl = `${CAMERA_2_SNAPSHOT_URL}?v=${streamVersion}`
  const playerUrl = nativePlayerUrl(CAMERA_2_STREAM)
  const webrtcOfferUrls = useMemo(() => uniqueUrls([
    withQueryParam(CAMERA_2_WEBRTC_OFFER_URL, CAMERA_2_WEBRTC_SOURCE_PARAM, CAMERA_2_STREAM),
    withQueryParam(CAMERA_2_WEBRTC_FALLBACK_OFFER_URL, CAMERA_2_WEBRTC_FALLBACK_SOURCE_PARAM, CAMERA_2_STREAM),
    withQueryParam('/api/v3/camera2/webrtc/offer', 'stream', CAMERA_2_STREAM),
  ]), [])
  const controlUrls = useMemo(() => uniqueUrls([
    CAMERA_2_CONTROL_URL,
    CAMERA_2_CONTROL_FALLBACK_URL,
    '/api/v3/camera2/control',
  ]), [])
  const controlWsUrls = useMemo(() => uniqueUrls([
    CAMERA_2_CONTROL_WS_URL,
    CAMERA_2_CONTROL_WS_FALLBACK_URL,
  ]), [])
  const settingsUrls = useMemo(() => uniqueUrls([
    CAMERA_2_SETTINGS_URL,
    CAMERA_2_SETTINGS_FALLBACK_URL,
    '/api/v3/camera2/settings',
  ]), [])
  const openUrl = CAMERA_2_NATIVE_URL === CAMERA_2_URL ? playerUrl : CAMERA_2_NATIVE_URL
  const statusCopy = cam2StatusCopy(status)
  const fallbackExhausted = playerFailed && (!CAMERA_FALLBACK_MEDIA_ENABLED || streamFailed) && !streamReady

  const reload = () => {
    setSnapshotReady(false)
    setPlayerReady(false)
    setPlayerFailed(false)
    setStreamReady(false)
    setStreamFailed(false)
    setStatus(null)
    setStreamVersion(Date.now())
  }

  const loadSettings = useCallback(() => {
    fetchJsonCandidate<Cam2Settings>(settingsUrls)
      .then((next) => setSettings(next))
      .catch(() => setSettings({ ok: false }))
  }, [settingsUrls])

  const sendControlWs = useCallback((payload: ControlPayload) => {
    const ws = controlWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(payload))
    return true
  }, [])

  const sendControlPayload = useCallback(async (payload: ControlPayload, keepalive = false) => {
    if (sendControlWs(payload)) return
    const body = JSON.stringify(payload)
    let lastError: unknown = null
    for (const url of controlUrls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          keepalive,
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        if (res.ok) return
        lastError = new Error(`control_${res.status}`)
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) throw lastError
  }, [controlUrls, sendControlWs])

  const sendControl = useCallback(async (
    command: Cam2Command,
    step: 'fine' | 'normal' | 'coarse' = 'normal',
    trackPending = true,
    hold = false,
  ) => {
    if (trackPending) {
      if (controlBusyRef.current) return
      controlBusyRef.current = true
      setControlPending(command)
    }
    try {
      await sendControlPayload({ command, step, ...(hold ? { hold: true } : {}) }, command === 'stop')
    } finally {
      if (trackPending) {
        controlBusyRef.current = false
        setControlPending(null)
      }
    }
  }, [sendControlPayload])

  const sendVectorControl = useCallback((x: number, y: number, speed: number) => {
    const payload: ControlPayload = {
      action: 'move',
      x: clampUnit(x),
      y: clampUnit(y),
      speed: clamp01(speed),
      step: 'fine',
    }
    void sendControlPayload(payload)
  }, [sendControlPayload])

  const stopVectorControl = useCallback(() => {
    void sendControlPayload({ command: 'stop', action: 'stop', step: 'fine' }, true)
  }, [sendControlPayload])

  const applyPreset = async (preset: 'hq30' | 'balanced24') => {
    setQualityPending(preset)
    try {
      const next = await postJsonCandidate<{ ok?: boolean; stream0?: Cam2Settings['stream0'] }>(settingsUrls, {
        method: 'POST',
        body: JSON.stringify({ preset }),
      })
      setSettings({ ok: next.ok !== false, stream0: next.stream0 ?? settings?.stream0 ?? null })
      reload()
    } finally {
      setQualityPending(null)
    }
  }

  useEffect(() => {
    loadSettings()
    return stopVectorControl
  }, [loadSettings, stopVectorControl])

  useEffect(() => {
    let disposed = false

    const connect = (index = 0) => {
      if (disposed || controlWsUrls.length === 0 || typeof WebSocket === 'undefined') return
      const url = controlWsUrls[index % controlWsUrls.length]
      try {
        const ws = new WebSocket(url)
        controlWsRef.current = ws
        ws.onopen = () => {
          if (controlWsRef.current === ws) setControlConnected(true)
        }
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as {
              motion?: Cam2MotionState
              interval_ms?: number
              ttl_ms?: number
              mode?: string
              command?: string
            }
            if (payload.motion) {
              setMotionState(payload.motion)
            } else if (payload.interval_ms || payload.ttl_ms || payload.mode) {
              setMotionState((prev) => ({
                ...prev,
                command: payload.command ?? prev?.command ?? null,
                interval_ms: payload.interval_ms ?? prev?.interval_ms,
                ttl_ms: payload.ttl_ms ?? prev?.ttl_ms,
                active: payload.mode === 'vector' || payload.mode === 'hold' ? true : payload.mode === 'stopped' ? false : prev?.active,
              }))
            }
          } catch {
            // Control ACKs are advisory; the stop fail-safe stays in the relay.
          }
        }
        ws.onclose = () => {
          if (controlWsRef.current === ws) controlWsRef.current = null
          setControlConnected(false)
          setMotionState((prev) => prev ? { ...prev, active: false } : prev)
          if (!disposed) {
            const nextIndex = (index + 1) % controlWsUrls.length
            controlWsRetryRef.current = setTimeout(() => connect(nextIndex), index === 0 ? 350 : 1200)
          }
        }
        ws.onerror = () => {
          try {
            ws.close()
          } catch {
            // Best effort only; HTTP control remains as fallback.
          }
        }
      } catch {
        if (!disposed) {
          const nextIndex = (index + 1) % controlWsUrls.length
          controlWsRetryRef.current = setTimeout(() => connect(nextIndex), index === 0 ? 350 : 1800)
        }
      }
    }

    connect()
    return () => {
      disposed = true
      if (controlWsRetryRef.current) clearTimeout(controlWsRetryRef.current)
      try {
        controlWsRef.current?.close()
      } catch {
        // Best effort cleanup only.
      }
      controlWsRef.current = null
      setControlConnected(false)
    }
  }, [controlWsUrls])

  useEffect(() => {
    const video = rtcVideoRef.current
    if (!video || typeof RTCPeerConnection === 'undefined') {
      setPlayerReady(false)
      setPlayerFailed(true)
      return
    }

    let cancelled = false
    let painted = false
    let rtcStats: Partial<Cam2PlaybackMetrics> = {}
    const pc = new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }],
    })
    const finiteNumber = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null
    const rounded = (value: unknown, places = 3): number | null => {
      const n = finiteNumber(value)
      return n == null ? null : Number(n.toFixed(places))
    }
    const playbackQuality = () => {
      const getQuality = video.getVideoPlaybackQuality
      if (typeof getQuality !== 'function') return {}
      const quality = getQuality.call(video)
      return {
        totalVideoFrames: rounded(quality.totalVideoFrames, 0),
        droppedVideoFrames: rounded(quality.droppedVideoFrames, 0),
        corruptedVideoFrames: rounded(quality.corruptedVideoFrames, 0),
      }
    }
    const publishMetrics = () => {
      if (cancelled) return
      setPlaybackMetrics({
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        currentTime: Number(video.currentTime.toFixed(3)),
        rtcConnectionState: pc.connectionState,
        rtcIceConnectionState: pc.iceConnectionState,
        ...playbackQuality(),
        ...rtcStats,
      })
    }
    const sampleRtcStats = async () => {
      try {
        const report = await pc.getStats()
        if (cancelled) return
        const nextStats: Partial<Cam2PlaybackMetrics> = {}
        let selectedPairId: string | null = null
        report.forEach((raw) => {
          const stat = raw as RTCStats & Record<string, unknown>
          if (stat.type === 'transport' && typeof stat.selectedCandidatePairId === 'string') {
            selectedPairId = stat.selectedCandidatePairId
          }
        })
        report.forEach((raw) => {
          const stat = raw as RTCStats & Record<string, unknown>
          if (stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.mediaType === 'video')) {
            nextStats.rtcBytesReceived = rounded(stat.bytesReceived, 0)
            nextStats.rtcPacketsLost = rounded(stat.packetsLost, 0)
            nextStats.rtcPacketsReceived = rounded(stat.packetsReceived, 0)
            nextStats.rtcJitterSec = rounded(stat.jitter, 4)
            nextStats.rtcFramesDecoded = rounded(stat.framesDecoded, 0)
            nextStats.rtcFramesDropped = rounded(stat.framesDropped, 0)
            nextStats.rtcFramesPerSecond = rounded(stat.framesPerSecond, 2)
          }
          if (
            stat.type === 'candidate-pair' &&
            (stat.id === selectedPairId || stat.selected === true || (stat.nominated === true && stat.state === 'succeeded'))
          ) {
            nextStats.rtcCurrentRoundTripTimeSec = rounded(stat.currentRoundTripTime, 4)
            const remote = typeof stat.remoteCandidateId === 'string' ? report.get(stat.remoteCandidateId) as RTCStats & Record<string, unknown> | undefined : undefined
            nextStats.selectedRemoteType = typeof remote?.candidateType === 'string' ? remote.candidateType : null
            nextStats.selectedRemoteProtocol = typeof remote?.protocol === 'string' ? remote.protocol : null
          }
        })
        rtcStats = nextStats
        publishMetrics()
      } catch {
        publishMetrics()
      }
    }

    const markLive = () => {
      if (cancelled) return
      painted = true
      setSnapshotReady(true)
      setPlayerReady(true)
      setPlayerFailed(false)
      setStreamReady(false)
      publishMetrics()
    }
    const fail = () => {
      if (cancelled || painted) return
      setPlayerReady(false)
      setPlayerFailed(true)
      publishMetrics()
    }
    const closePeer = () => {
      try {
        pc.getSenders().forEach((sender) => sender.track?.stop())
        pc.getReceivers().forEach((receiver) => receiver.track?.stop())
        pc.close()
      } catch {
        // Best effort cleanup only.
      }
    }

    video.muted = true
    video.playsInline = true
    video.addEventListener('loadeddata', markLive)
    video.addEventListener('playing', markLive)
    video.addEventListener('error', fail)

    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addEventListener('track', (event) => {
      const stream = event.streams[0] || new MediaStream([event.track])
      video.srcObject = stream
      video.play().catch(() => undefined)
    })
    pc.addEventListener('connectionstatechange', () => {
      publishMetrics()
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') fail()
    })
    pc.addEventListener('iceconnectionstatechange', () => {
      publishMetrics()
      if (pc.iceConnectionState === 'failed') fail()
    })

    const startTimeout = window.setTimeout(() => {
      if (!painted) fail()
    }, 8_000)
    const metricsTimer = window.setInterval(() => {
      publishMetrics()
      void sampleRtcStats()
    }, 1_000)

    const start = async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGatheringComplete(pc, 1_500)
        if (cancelled) return

        const sdp = pc.localDescription?.sdp
        if (!sdp) throw new Error('missing local SDP')
        const answer = await postSdpOfferCandidate(webrtcOfferUrls, sdp)
        if (cancelled) return
        await pc.setRemoteDescription({ type: 'answer', sdp: answer })
        publishMetrics()
        void sampleRtcStats()
      } catch {
        fail()
      }
    }

    setPlayerReady(false)
    setPlayerFailed(false)
    setPlaybackMetrics(null)
    start()

    return () => {
      cancelled = true
      window.clearTimeout(startTimeout)
      window.clearInterval(metricsTimer)
      video.removeEventListener('loadeddata', markLive)
      video.removeEventListener('playing', markLive)
      video.removeEventListener('error', fail)
      video.srcObject = null
      setPlaybackMetrics(null)
      closePeer()
    }
  }, [streamVersion, webrtcOfferUrls])

  useEffect(() => {
    if (!fallbackExhausted) return
    let cancelled = false
    fetchJsonCandidate<Cam2Status>([CAMERA_2_STATUS_URL, '/api/v3/camera2/status'])
      .then((next: Cam2Status) => {
        if (!cancelled) setStatus(next)
      })
      .catch(() => {
        if (!cancelled) setStatus({ ok: false })
      })
    return () => {
      cancelled = true
    }
  }, [fallbackExhausted, streamVersion])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-black">
      <img
        src={snapshotUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full"
        onLoad={() => setSnapshotReady(true)}
        onError={() => setSnapshotReady(false)}
        style={{
          objectFit: fit,
          objectPosition: position,
          opacity: playerReady || streamReady ? 0 : snapshotReady ? 1 : 0,
          transition: 'opacity 240ms ease',
          filter: 'saturate(1.02) contrast(1.03)',
        }}
      />

      <video
        ref={rtcVideoRef}
        muted
        playsInline
        autoPlay
        title="HatchingPoint Cam 2 high-quality live preview"
        aria-label="HatchingPoint Cam 2 high-quality live preview"
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: fit,
          objectPosition: position,
          opacity: playerReady ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      />

      {CAMERA_FALLBACK_MEDIA_ENABLED && playerFailed && (
        <img
          key={streamVersion}
          src={mjpegUrl}
          alt=""
          aria-label="HatchingPoint Cam 2 live preview"
          className="absolute inset-0 h-full w-full"
          onLoad={() => {
            setStreamReady(true)
            setStreamFailed(false)
          }}
          onError={() => {
            setStreamReady(false)
            setStreamFailed(true)
          }}
          style={{
            objectFit: fit,
            objectPosition: position,
            opacity: streamReady ? 1 : 0,
            transition: 'opacity 240ms ease',
          }}
        />
      )}

      {!snapshotReady && !playerReady && !streamReady && !streamFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase text-white/70"
            style={{
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.16), rgba(255,255,255,0.05))',
              backgroundSize: '200% 100%',
              animation: 'thinginoShimmer 1.2s linear infinite',
            }}
          >
            opening cam 2...
          </div>
        </div>
      )}

      {fallbackExhausted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
          <div className="flex max-w-[18rem] flex-col items-center gap-3">
            <img
              src="/images/hatchingpoint-mark.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9"
              style={{ filter: isLight ? 'none' : 'drop-shadow(0 0 10px rgba(255,255,255,0.16))' }}
            />
            <div className="text-[11px] font-semibold uppercase text-white/76">
              Cam 2 camera offline
            </div>
            <div className="text-[11px] leading-snug text-white/58">
              {statusCopy}
            </div>
            <button
              type="button"
              onClick={reload}
              className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase text-white/85 transition hover:text-white"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              retry
            </button>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full px-2.5 py-1"
        style={{
          background: 'rgba(0,0,0,0.62)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <img src="/images/hatchingpoint-mark.png" alt="" aria-hidden="true" className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase">HatchingPoint / Cam 2</span>
      </div>

      <div
        className="pointer-events-none absolute right-3 top-11 hidden rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase sm:block"
        style={{
          background: 'rgba(0,0,0,0.58)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {formatPlaybackTelemetry(playbackMetrics, settings)}
      </div>

      <div
        className="pointer-events-auto absolute bottom-3 left-3 z-30 flex max-w-[calc(100%-5.25rem)] items-end gap-2"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Cam2Joystick
          connected={controlConnected}
          motion={motionState}
          onMove={sendVectorControl}
          onStop={stopVectorControl}
          onHome={() => void sendControl('home')}
          homeDisabled={controlPending != null}
        />

        <div
          className="hidden min-w-[132px] flex-col gap-1 rounded-[14px] p-1.5 sm:flex"
          aria-label="Cam 2 quality controls"
          style={{
            background: 'rgba(0,0,0,0.58)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <div className="px-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {formatStreamSettings(settings)}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => applyPreset('hq30')}
              disabled={qualityPending != null}
              className="rounded-[8px] px-2 py-1 text-[9px] font-bold uppercase text-white/88 transition hover:bg-white/18 disabled:opacity-45"
              style={{ background: qualityPending === 'hq30' ? 'rgba(103,232,249,0.24)' : 'rgba(255,255,255,0.10)' }}
            >
              Max 30
            </button>
            <button
              type="button"
              onClick={() => applyPreset('balanced24')}
              disabled={qualityPending != null}
              className="rounded-[8px] px-2 py-1 text-[9px] font-bold uppercase text-white/78 transition hover:bg-white/18 disabled:opacity-45"
              style={{ background: qualityPending === 'balanced24' ? 'rgba(103,232,249,0.24)' : 'rgba(255,255,255,0.08)' }}
            >
              24 fps
            </button>
          </div>
        </div>
      </div>

      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-3 right-3 z-30 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase opacity-70 transition-opacity hover:opacity-100"
        style={{
          background: 'rgba(0,0,0,0.58)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        open
      </a>

      <style jsx global>{`
        @keyframes thinginoShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}

function Cam2Joystick({
  connected,
  motion,
  homeDisabled,
  onMove,
  onStop,
  onHome,
}: {
  connected: boolean
  motion: Cam2MotionState | null
  homeDisabled: boolean
  onMove: (x: number, y: number, speed: number) => void
  onStop: () => void
  onHome: () => void
}) {
  const padRef = useRef<HTMLDivElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastVectorRef = useRef({ x: 0, y: 0, speed: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false })
  const motionActive = knob.active || motion?.active === true

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const sendVector = useCallback((next: { x: number; y: number; speed: number }) => {
    lastVectorRef.current = next
    onMove(next.x, next.y, next.speed)
  }, [onMove])

  const updateFromPointer = useCallback((event: PointerEvent<HTMLDivElement>, immediate = false) => {
    const pad = padRef.current
    if (!pad) return
    const next = joystickVectorFromPointer(event, pad)
    setKnob({ x: next.x, y: next.y, active: next.speed > 0 })
    lastVectorRef.current = next
    if (immediate) onMove(next.x, next.y, next.speed)
  }, [onMove])

  const stop = useCallback(() => {
    activePointerRef.current = null
    clearHeartbeat()
    lastVectorRef.current = { x: 0, y: 0, speed: 0 }
    setKnob({ x: 0, y: 0, active: false })
    onStop()
  }, [clearHeartbeat, onStop])

  useEffect(() => {
    const stopOnPageExit = () => stop()
    window.addEventListener('pagehide', stopOnPageExit)
    document.addEventListener('visibilitychange', stopOnPageExit)
    return () => {
      window.removeEventListener('pagehide', stopOnPageExit)
      document.removeEventListener('visibilitychange', stopOnPageExit)
      stop()
    }
  }, [stop])

  return (
    <div
      className="flex items-center gap-1.5 rounded-[14px] p-1.5"
      aria-label="Cam 2 pan and tilt controls"
      style={{
        background: 'rgba(0,0,0,0.58)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        ref={padRef}
        role="application"
        aria-label="Cam 2 joystick"
        onPointerDown={(event) => {
          event.preventDefault()
          activePointerRef.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          updateFromPointer(event, true)
          clearHeartbeat()
          heartbeatRef.current = setInterval(() => {
            const next = lastVectorRef.current
            if (next.speed > 0) onMove(next.x, next.y, next.speed)
          }, 70)
        }}
        onPointerMove={(event) => {
          if (activePointerRef.current !== event.pointerId) return
          event.preventDefault()
          updateFromPointer(event, false)
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          stop()
        }}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(event) => event.preventDefault()}
        className="relative h-[72px] w-[72px] touch-none rounded-full"
        style={{
          background: motionActive
            ? 'radial-gradient(circle at 50% 50%, rgba(103,232,249,0.24), rgba(255,255,255,0.08) 58%, rgba(255,255,255,0.04))'
            : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14), rgba(255,255,255,0.07) 58%, rgba(255,255,255,0.035))',
          boxShadow: motionActive ? '0 0 18px rgba(103,232,249,0.22)' : undefined,
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-px w-[54px] -translate-x-1/2 bg-white/18"
          aria-hidden="true"
        />
        <div
          className="absolute left-1/2 top-1/2 h-[54px] w-px -translate-y-1/2 bg-white/18"
          aria-hidden="true"
        />
        <div
          className="absolute left-1/2 top-1/2 h-6 w-6 rounded-full border border-white/35 bg-white/22"
          aria-hidden="true"
          style={{
            transform: `translate(calc(-50% + ${knob.x * 24}px), calc(-50% + ${-knob.y * 24}px))`,
            boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
          }}
        />
      </div>
      <div className="flex h-[72px] flex-col justify-between">
        <button
          type="button"
          aria-label="Home camera"
          disabled={homeDisabled}
          onClick={onHome}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-bold text-white/86 transition hover:bg-white/18 hover:text-white disabled:opacity-45"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          ⌂
        </button>
        <div
          className="rounded-full px-1.5 py-0.5 text-center text-[8px] font-bold uppercase tracking-[0.12em]"
          style={{
            background: connected ? 'rgba(16,185,129,0.20)' : 'rgba(245,158,11,0.18)',
            color: connected ? '#a7f3d0' : '#fed7aa',
          }}
        >
          {connected ? 'WS' : 'HTTP'}
        </div>
      </div>
    </div>
  )
}

function formatStreamSettings(settings: Cam2Settings | null) {
  const stream = settings?.stream0
  if (!stream) return 'loading'
  const resolution = stream.width && stream.height ? `${stream.width}×${stream.height}` : 'stream'
  const fps = stream.fps ? `${stream.fps} fps` : 'fps'
  const bitrate = stream.bitrate ? `${Math.round(stream.bitrate / 100) / 10} Mbps` : ''
  return [resolution, fps, bitrate].filter(Boolean).join(' · ')
}

function formatPlaybackTelemetry(metrics: Cam2PlaybackMetrics | null, settings: Cam2Settings | null) {
  const stream = settings?.stream0
  const resolution = metrics?.videoWidth && metrics.videoHeight
    ? `${metrics.videoWidth}×${metrics.videoHeight}`
    : stream?.width && stream.height
      ? `${stream.width}×${stream.height}`
      : 'video'
  const fps = typeof metrics?.rtcFramesPerSecond === 'number'
    ? `${formatMetricNumber(metrics.rtcFramesPerSecond)}fps actual`
    : stream?.fps
      ? `${stream.fps}fps target`
      : 'fps'
  const jitter = typeof metrics?.rtcJitterSec === 'number'
    ? `${Math.round(metrics.rtcJitterSec * 1000)}ms jitter`
    : null
  const rtt = typeof metrics?.rtcCurrentRoundTripTimeSec === 'number'
    ? `${Math.round(metrics.rtcCurrentRoundTripTimeSec * 1000)}ms rtt`
    : null
  const path = metrics?.selectedRemoteType
    ? `${metrics.selectedRemoteType}${metrics.selectedRemoteProtocol ? `/${metrics.selectedRemoteProtocol}` : ''}`
    : null
  return [resolution, fps, jitter, rtt, path].filter(Boolean).join(' · ')
}

function joystickVectorFromPointer(event: PointerEvent<HTMLDivElement>, pad: HTMLDivElement) {
  const rect = pad.getBoundingClientRect()
  const rawX = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const rawY = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  const magnitude = Math.hypot(rawX, rawY)
  const deadZone = 0.08
  if (!Number.isFinite(magnitude) || magnitude < deadZone) return { x: 0, y: 0, speed: 0 }
  const scale = magnitude > 1 ? 1 / magnitude : 1
  const x = clampUnit(rawX * scale)
  const y = clampUnit(rawY * scale)
  const speed = clamp01((Math.min(1, magnitude) - deadZone) / (1 - deadZone))
  return { x, y, speed }
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function formatMetricNumber(value: number) {
  if (!Number.isFinite(value)) return '0'
  return Math.abs(value - Math.round(value)) < 0.05 ? String(Math.round(value)) : value.toFixed(1)
}

function nativePlayerUrl(stream: string): string {
  const params = new URLSearchParams({
    src: stream,
    mode: PLAYER_MODE,
    background: 'false',
    width: '100%',
  })
  return `${CAMERA_HOST}/stream.html?${params.toString()}`
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const url of urls) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    next.push(url)
  }
  return next
}

function withQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

async function fetchJsonCandidate<T>(urls: string[]): Promise<T> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        lastError = new Error(`${url}_${res.status}`)
        continue
      }
      return await res.json() as T
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('all_candidates_failed')
}

async function postJsonCandidate<T>(urls: string[], init: RequestInit): Promise<T> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        ...init,
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      })
      const data = await res.json().catch(() => null) as T | null
      if (res.ok && data) return data
      lastError = new Error(`${url}_${res.status}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('all_candidates_failed')
}

async function postSdpOfferCandidate(urls: string[], sdp: string): Promise<string> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/sdp' },
        body: sdp,
      })
      const answer = await res.text()
      if (res.ok && answer.includes('v=0') && answer.includes('m=')) return answer
      lastError = new Error(`${url}_${res.status}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('all_candidates_failed')
}

function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      pc.removeEventListener('icegatheringstatechange', onStateChange)
      resolve()
    }
    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') done()
    }
    const timeout = window.setTimeout(done, timeoutMs)
    pc.addEventListener('icegatheringstatechange', onStateChange)
  })
}
