'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CAMERA_FALLBACK_MEDIA_ENABLED,
  CAMERA_2_CONTROL_URL,
  CAMERA_2_CONTROL_WS_URL,
  CAMERA_2_MJPEG_URL,
  CAMERA_2_NATIVE_URL,
  CAMERA_2_SNAPSHOT_URL,
  CAMERA_2_SETTINGS_URL,
  CAMERA_2_STREAM,
  CAMERA_2_STATUS_URL,
  CAMERA_2_URL,
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
}
type Cam2Settings = {
  ok?: boolean
  stream0?: {
    width?: number
    height?: number
    fps?: number
    bitrate?: number
  } | null
}
type Cam2Command = 'ul' | 'uc' | 'ur' | 'cl' | 'center' | 'cr' | 'dl' | 'dc' | 'dr' | 'home' | 'stop'

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
  const [qualityPending, setQualityPending] = useState<string | null>(null)
  const rtcVideoRef = useRef<HTMLVideoElement>(null)
  const controlWsRef = useRef<WebSocket | null>(null)
  const controlWsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heldCommandRef = useRef<Cam2Command | null>(null)
  const controlBusyRef = useRef(false)
  const mjpegUrl = `${CAMERA_2_MJPEG_URL}?v=${streamVersion}`
  const snapshotUrl = `${CAMERA_2_SNAPSHOT_URL}?v=${streamVersion}`
  const playerUrl = nativePlayerUrl(CAMERA_2_STREAM)
  const webrtcOfferUrl = withQueryParam(CAMERA_2_WEBRTC_OFFER_URL, CAMERA_2_WEBRTC_SOURCE_PARAM, CAMERA_2_STREAM)
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
    fetch(CAMERA_2_SETTINGS_URL, { cache: 'no-store' })
      .then((r) => r.json())
      .then((next: Cam2Settings) => setSettings(next))
      .catch(() => setSettings({ ok: false }))
  }, [])

  const sendControlWs = useCallback((
    command: Cam2Command,
    step: 'fine' | 'normal' | 'coarse' = 'normal',
    hold = false,
  ) => {
    const ws = controlWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify({ command, step, ...(hold ? { hold: true } : {}) }))
    return true
  }, [])

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
      if ((hold || command === 'stop') && sendControlWs(command, step, hold)) {
        return
      }
      await fetch(CAMERA_2_CONTROL_URL, {
        method: 'POST',
        keepalive: command === 'stop',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, step, ...(hold ? { hold: true } : {}) }),
      })
    } finally {
      if (trackPending) {
        controlBusyRef.current = false
        setControlPending(null)
      }
    }
  }, [sendControlWs])

  const stopHold = useCallback(() => {
    const wasHolding = heldCommandRef.current != null
    heldCommandRef.current = null
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (wasHolding) void sendControl('stop', 'fine', false)
  }, [sendControl])

  const startHold = useCallback((command: Cam2Command) => {
    stopHold()
    heldCommandRef.current = command
    void sendControl(command, 'fine', false, true)
    holdTimerRef.current = setInterval(() => {
      if (heldCommandRef.current === command) void sendControl(command, 'fine', false, true)
    }, 450)
  }, [sendControl, stopHold])

  const applyPreset = async (preset: 'hq30' | 'balanced24') => {
    setQualityPending(preset)
    try {
      const res = await fetch(CAMERA_2_SETTINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      })
      const next = await res.json().catch(() => null)
      if (next) setSettings({ ok: res.ok, stream0: next.stream0 ?? settings?.stream0 ?? null })
      reload()
    } finally {
      setQualityPending(null)
    }
  }

  useEffect(() => {
    loadSettings()
    return stopHold
  }, [loadSettings, stopHold])

  useEffect(() => {
    let disposed = false

    const connect = () => {
      if (disposed || !CAMERA_2_CONTROL_WS_URL || typeof WebSocket === 'undefined') return
      try {
        const ws = new WebSocket(CAMERA_2_CONTROL_WS_URL)
        controlWsRef.current = ws
        ws.onclose = () => {
          if (controlWsRef.current === ws) controlWsRef.current = null
          if (!disposed) {
            controlWsRetryRef.current = setTimeout(connect, 1200)
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
          controlWsRetryRef.current = setTimeout(connect, 1800)
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
    }
  }, [])

  useEffect(() => {
    const video = rtcVideoRef.current
    if (!video || typeof RTCPeerConnection === 'undefined') {
      setPlayerReady(false)
      setPlayerFailed(true)
      return
    }

    let cancelled = false
    let painted = false
    const pc = new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }],
    })

    const markLive = () => {
      if (cancelled) return
      painted = true
      setSnapshotReady(true)
      setPlayerReady(true)
      setPlayerFailed(false)
      setStreamReady(false)
    }
    const fail = () => {
      if (cancelled || painted) return
      setPlayerReady(false)
      setPlayerFailed(true)
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
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') fail()
    })
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed') fail()
    })

    const startTimeout = window.setTimeout(() => {
      if (!painted) fail()
    }, 8_000)

    const start = async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGatheringComplete(pc, 1_500)
        if (cancelled) return

        const sdp = pc.localDescription?.sdp
        if (!sdp) throw new Error('missing local SDP')
        const res = await fetch(webrtcOfferUrl, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/sdp' },
          body: sdp,
        })
        if (!res.ok) throw new Error(`webrtc offer failed: ${res.status}`)
        const answer = await res.text()
        if (cancelled) return
        await pc.setRemoteDescription({ type: 'answer', sdp: answer })
      } catch {
        fail()
      }
    }

    setPlayerReady(false)
    setPlayerFailed(false)
    start()

    return () => {
      cancelled = true
      window.clearTimeout(startTimeout)
      video.removeEventListener('loadeddata', markLive)
      video.removeEventListener('playing', markLive)
      video.removeEventListener('error', fail)
      video.srcObject = null
      closePeer()
    }
  }, [streamVersion, webrtcOfferUrl])

  useEffect(() => {
    if (!fallbackExhausted) return
    let cancelled = false
    fetch(CAMERA_2_STATUS_URL, { cache: 'no-store' })
      .then((r) => r.json())
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
        H.264 · 30fps · WebRTC
      </div>

      <div
        className="pointer-events-auto absolute bottom-3 left-3 z-30 flex items-end gap-2"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div
          className="grid grid-cols-3 gap-1 rounded-[14px] p-1"
          aria-label="Cam 2 pan and tilt controls"
          style={{
            background: 'rgba(0,0,0,0.58)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {[
            ['ul', '↖', 'Pan up left'],
            ['uc', '↑', 'Tilt up'],
            ['ur', '↗', 'Pan up right'],
            ['cl', '←', 'Pan left'],
            ['home', '⌂', 'Home camera'],
            ['cr', '→', 'Pan right'],
            ['dl', '↙', 'Pan down left'],
            ['dc', '↓', 'Tilt down'],
            ['dr', '↘', 'Pan down right'],
          ].map(([command, label, aria]) => (
            <button
              key={command}
              type="button"
              aria-label={aria}
              disabled={command === 'home' && controlPending != null}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                const cmd = command as Cam2Command
                if (cmd === 'home') {
                  void sendControl(cmd)
                } else {
                  startHold(cmd)
                }
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
                stopHold()
              }}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onLostPointerCapture={stopHold}
              onContextMenu={(event) => event.preventDefault()}
              className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[13px] font-bold text-white/85 transition hover:bg-white/18 hover:text-white disabled:opacity-45"
              style={{ background: command === 'home' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)' }}
            >
              {label}
            </button>
          ))}
        </div>

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

function formatStreamSettings(settings: Cam2Settings | null) {
  const stream = settings?.stream0
  if (!stream) return 'loading'
  const resolution = stream.width && stream.height ? `${stream.width}×${stream.height}` : 'stream'
  const fps = stream.fps ? `${stream.fps} fps` : 'fps'
  const bitrate = stream.bitrate ? `${Math.round(stream.bitrate / 100) / 10} Mbps` : ''
  return [resolution, fps, bitrate].filter(Boolean).join(' · ')
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

function withQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
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
