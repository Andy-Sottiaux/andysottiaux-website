'use client'

/* eslint-disable @next/next/no-img-element -- Live camera snapshots and MJPEG streams must bypass next/image optimization. */

import Image from 'next/image'
import { LockKeyhole } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAMERA_FALLBACK_MEDIA_ENABLED,
  CAMERA_2_MJPEG_URL,
  CAMERA_2_SNAPSHOT_URL,
  CAMERA_2_STREAM,
  CAMERA_2_STATUS_URL,
  CAMERA_2_WEBRTC_OFFER_URL,
  CAMERA_2_WEBRTC_SOURCE_PARAM,
} from '@/lib/fieldCameraConfig'
import { useFieldTheme } from './fieldTheme'
import Cam2Joystick from './camera/Cam2Joystick'
import { type Cam2Settings, useCam2Control } from './camera/useCam2Control'

type VideoFit = 'contain' | 'cover' | 'fill'
type Cam2Status = {
  ok?: boolean
  error?: string
  upstream_status?: number
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
  const {
    settings,
    controlPending,
    controlConnected,
    motionState,
    sendControl,
    sendVectorControl,
    stopVectorControl,
    unlocked,
    requestUnlock,
  } = useCam2Control()
  const isLight = palette.mode === 'light'
  const [streamVersion, setStreamVersion] = useState(0)
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerFailed, setPlayerFailed] = useState(false)
  const [streamReady, setStreamReady] = useState(false)
  const [streamFailed, setStreamFailed] = useState(false)
  const [status, setStatus] = useState<Cam2Status | null>(null)
  const [playbackMetrics, setPlaybackMetrics] = useState<Cam2PlaybackMetrics | null>(null)
  const rtcVideoRef = useRef<HTMLVideoElement>(null)
  const mjpegUrl = `${CAMERA_2_MJPEG_URL}?v=${streamVersion}`
  const snapshotUrl = `${CAMERA_2_SNAPSHOT_URL}?v=${streamVersion}`
  const webrtcOfferUrls = useMemo(() => [
    withQueryParam(CAMERA_2_WEBRTC_OFFER_URL, CAMERA_2_WEBRTC_SOURCE_PARAM, CAMERA_2_STREAM),
  ], [])
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
              animation: 'thinginoShimmer 0.9s linear infinite',
            }}
          >
            opening cam 2...
          </div>
        </div>
      )}

      {fallbackExhausted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
          <div className="flex max-w-[18rem] flex-col items-center gap-3">
            <Image
              src="/images/hatchingpoint-mark.png"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
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
        <Image src="/images/hatchingpoint-mark.png" alt="" aria-hidden="true" width={16} height={16} className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase">HatchingPoint / Cam 2</span>
      </div>

      <div
        className="pointer-events-none absolute right-3 top-3 hidden max-w-[calc(100%-1.5rem)] rounded-full px-2.5 py-1 text-right text-[9px] font-semibold uppercase sm:block"
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
        {unlocked ? (
          <Cam2Joystick
            connected={controlConnected}
            motion={motionState}
            onMove={sendVectorControl}
            onStop={stopVectorControl}
            onHome={() => void sendControl('home')}
            homeDisabled={controlPending != null}
          />
        ) : (
          <button
            type="button"
            onClick={() => void requestUnlock()}
            aria-label="Unlock camera controls"
            className="flex h-[84px] w-[112px] flex-col items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-black/60 text-white/80 backdrop-blur-[10px] transition hover:bg-black/70 hover:text-white"
          >
            <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            <span className="text-[8px] font-bold uppercase tracking-[0.12em]">Unlock</span>
          </button>
        )}
      </div>

      <style>{`
        @keyframes thinginoShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
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

function formatMetricNumber(value: number) {
  if (!Number.isFinite(value)) return '0'
  return Math.abs(value - Math.round(value)) < 0.05 ? String(Math.round(value)) : value.toFixed(1)
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
      if (res.ok && /(?:^|\r?\n)v=0[\s\S]*(?:^|\r?\n)m=/m.test(answer)) return answer
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
