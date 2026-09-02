'use client'

/* eslint-disable @next/next/no-img-element -- Live camera snapshots and MJPEG streams must bypass next/image optimization. */

/**
 * FieldCameraFeed renders the lowest-latency relay camera surface that is safe
 * for a public website embed.
 *
 * Same-origin sanitized HLS is the default embedded path because browsers block
 * public pages from directly embedding the Tailscale Funnel media origin as a
 * local/private-network subresource. go2rtc WebRTC/MSE stays available as an
 * authenticated same-origin player path.
 */

import { type CSSProperties, type RefObject, useEffect, useReducer, useRef, useState } from 'react'
import {
  CAMERA_FALLBACK_MEDIA_ENABLED,
  DETECTIONS_URL as DETECTIONS_BASE_URL,
  HEALTH_URL,
  HLS_URL,
  HTTP_RTC_ENABLED,
  MJPEG_URL,
  PRIMARY_FEED_STREAM,
  QUALITY_URL,
  SNAPSHOT_URL,
  TRAINING_STATUS_URL,
  WEBRTC_OFFER_URL,
  WEBRTC_SOURCE_PARAM,
} from '@/lib/fieldCameraConfig'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { useFieldTheme } from './fieldTheme'

const DETECTION_WINDOW_SEC = 60
const DETECTIONS_POLL_URL = withQueryParams(DETECTIONS_BASE_URL, { window_sec: DETECTION_WINDOW_SEC })
const SNAPSHOT_REFRESH_MS = 15_000
const STREAM_START_TIMEOUT_MS = 20_000
const HTTP_RTC_START_TIMEOUT_MS = 4_000
const HTTP_RTC_ICE_GATHER_TIMEOUT_MS = 1_500
const HTTP_RTC_HEALTH_GRACE_MS = 5_000
const HTTP_RTC_HEALTH_SAMPLE_MS = 3_000
const HTTP_RTC_BAD_SAMPLE_LIMIT = 2
const HTTP_RTC_MIN_PROGRESS_RATIO = 0.9
const HTTP_RTC_MAX_VIDEO_DROP_RATIO = 0.32
const HTTP_RTC_MAX_PACKET_LOSS_RATIO = 0.2
const HTTP_RTC_PACKET_LOSS_FRAME_DROP_RATIO = 0.08
const HLS_RETRY_MS = 3_000
const STALE_CLEAN_FRAME_SEC = 10
const LIVE_EDGE_TARGET_SEC = 2.0
const LIVE_EDGE_SOFT_DRIFT_SEC = 2.9
const LIVE_EDGE_HARD_DRIFT_SEC = 4.5
const LIVE_EDGE_CATCHUP_RATE = 1.04
const LIVE_EDGE_MIN_CATCHUP_BUFFER_SEC = 1.4

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
    hls_bitrate?: string
    hls_ok?: boolean | null
    hls_latest_write_age_s?: number | null
    hls_frames_written?: number
    hls_frames_dropped?: number
    framed_frames_read?: number
    framed_frames_segmented?: number
    framed_udp_listen?: string | null
    framed_udp_fec_packets?: number
    framed_udp_fec_recovered?: number
    framed_udp_incomplete_frames?: number
    observed_hls_fps?: number | null
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

type QualityRateSample = {
  ts: number
  hlsFramesWritten: number
}

type CameraPlaybackMetrics = {
  mode: 'hls' | 'rtc'
  readyState: number
  videoWidth?: number | null
  videoHeight?: number | null
  videoTimeSec: number
  bufferedAheadSec: number | null
  hlsLatencySec: number | null
  hlsEdgeSec: number | null
  hlsTargetLatencySec: number | null
  hlsMaxLatencySec: number | null
  liveSyncPositionSec: number | null
  playbackRate: number
  updatedAtMs: number
  videoCorruptedFrames?: number | null
  videoDroppedFrames?: number | null
  videoTotalFrames?: number | null
  rtcConnectionState?: RTCPeerConnectionState
  rtcIceConnectionState?: RTCIceConnectionState
  rtcAvailableIncomingBitrate?: number | null
  rtcBytesReceived?: number | null
  rtcCurrentRoundTripTimeSec?: number | null
  rtcDegradedReason?: string | null
  rtcFramesDecoded?: number | null
  rtcFramesDropped?: number | null
  rtcFramesPerSecond?: number | null
  rtcJitterSec?: number | null
  rtcPacketsLost?: number | null
  rtcPacketsReceived?: number | null
}

type CameraPlaybackState = {
  active: boolean
  phase: Phase
  snapshotNonce: number
  streamNonce: number
  snapshotReady: boolean
  streamReady: boolean
  httpRtcReady: boolean
  httpRtcFailed: boolean
  hlsReady: boolean
  hlsFailed: boolean
  hlsRetryCount: number
  playbackMetrics: CameraPlaybackMetrics | null
}

type CameraPlaybackAction =
  | { type: 'sync-active'; active: boolean; now: number }
  | { type: 'reload'; now: number }
  | { type: 'start-timeout' }
  | { type: 'refresh-snapshot'; now: number }
  | { type: 'http-rtc-unsupported' }
  | { type: 'http-rtc-live' }
  | { type: 'http-rtc-failed'; hlsPainted: boolean }
  | { type: 'hls-live' }
  | { type: 'hls-failed'; rtcPainted: boolean }
  | { type: 'hls-recovering' }
  | { type: 'hls-cleanup' }
  | { type: 'retry-hls' }
  | { type: 'media-offline' }
  | { type: 'snapshot-live' }
  | { type: 'snapshot-error'; hasPaintedTransport: boolean }
  | { type: 'snapshot-preview'; canPreview: boolean }
  | { type: 'video-live' }
  | { type: 'video-error'; canPreview: boolean }
  | { type: 'metrics'; metrics: CameraPlaybackMetrics | null }

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

type TrainingStatus = {
  ok?: boolean
  state?: string
  dataset_ready?: boolean
  scene_ready?: boolean
  training_ready?: boolean
  selected_dataset?: string | null
  short_action?: string | null
  collection_wait?: {
    status?: string | null
    preflight_count?: number | null
    capture?: {
      attempts?: number | null
      kept?: number | null
      duplicates?: number | null
      invalid?: number | null
      diverse_attempt_ratio?: number | null
    }
    preflight_progress?: CollectionProgress | null
    guided_progress?: CollectionProgress | null
  }
  model_wait?: {
    status?: string | null
    status_count?: number | null
    latest_pipeline_status?: string | null
    readiness_failures?: string[]
  }
  production_readiness?: {
    ok?: boolean
    status?: string | null
    short_action?: string | null
    failures?: string[]
    total_images?: number | null
    labeled_images?: number | null
    total_labels?: number | null
    nonzero_classes?: Record<string, number>
    image_diversity?: {
      unique_images?: number | null
      labeled_unique_images?: number | null
    }
    collection_plan?: {
      min_new_images?: number | null
      min_new_labeled_images?: number | null
      min_new_labels?: number | null
      min_new_classes?: number | null
      min_new_unique_images?: number | null
      min_new_labeled_unique_images?: number | null
      focus?: string[]
    } | null
  } | null
  label_seed?: {
    name?: string | null
    total_images?: number | null
    labeled_images?: number | null
    total_labels?: number | null
    classes?: Record<string, number>
    excluded?: boolean | null
  } | null
  error?: string
}

type CollectionProgress = {
  available?: boolean
  status?: string | null
  ok?: boolean | null
  attempts?: number | null
  kept?: number | null
  duplicates?: number | null
  invalid?: number | null
  fetch_failed?: number | null
  duplicate_ratio?: number | null
  diverse_attempt_ratio?: number | null
  valid_attempt_ratio?: number | null
  latest_event_age_s?: number | null
  finish_reason?: string | null
  session_status?: string | null
  min_kept?: number | null
  min_diverse_attempt_ratio?: number | null
  sample_target_frames?: number | null
  failures?: {
    kind?: string | null
    detail?: string | null
    actual?: number | string | null
    required?: number | string | null
  }[]
  recommendations?: string[]
}

function resetPlaybackState(
  previous: CameraPlaybackState | null,
  active: boolean,
  now: number,
): CameraPlaybackState {
  return {
    active,
    phase: active ? 'connecting' : 'paused',
    snapshotNonce: active ? now : (previous?.snapshotNonce ?? 0),
    streamNonce: active ? (previous?.streamNonce ?? 0) + 1 : (previous?.streamNonce ?? 0),
    snapshotReady: false,
    streamReady: false,
    httpRtcReady: false,
    httpRtcFailed: !HTTP_RTC_ENABLED,
    hlsReady: false,
    hlsFailed: false,
    hlsRetryCount: 0,
    playbackMetrics: null,
  }
}

function createInitialPlaybackState(active: boolean): CameraPlaybackState {
  return resetPlaybackState(null, active, active ? Date.now() : 0)
}

function transitionAfterTransportFailure(phase: Phase, alternatePainted: boolean): Phase {
  if (alternatePainted) return 'live'
  return phase === 'connecting' || phase === 'live' ? 'preview' : phase
}

function cameraPlaybackReducer(
  state: CameraPlaybackState,
  action: CameraPlaybackAction,
): CameraPlaybackState {
  switch (action.type) {
    case 'sync-active':
      return state.active === action.active ? state : resetPlaybackState(state, action.active, action.now)
    case 'reload':
      return resetPlaybackState(state, true, action.now)
    case 'start-timeout':
      return state.phase === 'connecting' ? { ...state, phase: 'offline' } : state
    case 'refresh-snapshot':
      return { ...state, snapshotNonce: action.now }
    case 'http-rtc-unsupported':
      return { ...state, httpRtcFailed: true }
    case 'http-rtc-live':
      return {
        ...state,
        httpRtcReady: true,
        snapshotReady: true,
        streamReady: true,
        phase: 'live',
      }
    case 'http-rtc-failed':
      return {
        ...state,
        httpRtcReady: false,
        httpRtcFailed: true,
        streamReady: action.hlsPainted,
        phase: transitionAfterTransportFailure(state.phase, action.hlsPainted),
      }
    case 'hls-live':
      return {
        ...state,
        hlsReady: true,
        snapshotReady: true,
        streamReady: true,
        hlsRetryCount: 0,
        phase: 'live',
      }
    case 'hls-failed':
      return {
        ...state,
        hlsReady: false,
        streamReady: action.rtcPainted,
        hlsFailed: true,
        hlsRetryCount: state.hlsRetryCount + 1,
        phase: transitionAfterTransportFailure(state.phase, action.rtcPainted),
      }
    case 'hls-recovering':
      return { ...state, phase: 'connecting' }
    case 'hls-cleanup':
      return { ...state, hlsReady: false, playbackMetrics: null }
    case 'retry-hls':
      return {
        ...state,
        phase: 'connecting',
        streamReady: false,
        hlsFailed: false,
        streamNonce: state.streamNonce + 1,
      }
    case 'media-offline':
      return state.phase === 'live' || state.phase === 'preview' || state.phase === 'connecting'
        ? { ...state, phase: 'offline' }
        : state
    case 'snapshot-live':
      return { ...state, snapshotReady: true }
    case 'snapshot-preview':
      return {
        ...state,
        phase: action.canPreview && (state.phase === 'connecting' || state.phase === 'offline') ? 'preview' : state.phase,
      }
    case 'snapshot-error':
      return {
        ...state,
        snapshotReady: false,
        phase: state.phase === 'live' && action.hasPaintedTransport ? state.phase : 'offline',
      }
    case 'video-live':
      return {
        ...state,
        snapshotReady: true,
        streamReady: true,
        phase: 'live',
      }
    case 'video-error':
      return {
        ...state,
        streamReady: false,
        phase: action.canPreview ? 'preview' : 'offline',
      }
    case 'metrics':
      return { ...state, playbackMetrics: action.metrics }
    default:
      return state
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
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rtcVideoRef = useRef<HTMLVideoElement>(null)
  const [playback, dispatchPlayback] = useReducer(
    cameraPlaybackReducer,
    enabled && initialActive(),
    createInitialPlaybackState,
  )
  const {
    active,
    phase,
    snapshotNonce,
    streamNonce,
    snapshotReady,
    streamReady,
    httpRtcReady,
    httpRtcFailed,
    hlsReady,
    hlsFailed,
    hlsRetryCount,
    playbackMetrics,
  } = playback
  const debugMode = useDebugFlag()
  const overlay = useCameraHealthOverlay(active)
  const detections = useDetectionOverlay(active)
  const quality = useCameraQuality(active)
  const training = useTrainingStatus(active)
  const mediaWidth = overlay.profile?.width || 1280
  const mediaHeight = overlay.profile?.height || 960
  const videoLayout = useOverlayLayout(containerRef, fit, position, mediaWidth, mediaHeight)
  const snapshotUrl = withQueryParams(SNAPSHOT_URL, { v: snapshotNonce })
  const mjpegUrl = withQueryParams(MJPEG_URL, { v: streamNonce })
  const hlsUrl = withQueryParams(HLS_URL, { v: streamNonce })
  const webrtcOfferUrl = withQueryParams(WEBRTC_OFFER_URL, {
    [WEBRTC_SOURCE_PARAM]: PRIMARY_FEED_STREAM,
    v: streamNonce,
  })
  const mediaHealthBad = isConfirmedCameraBad(quality)
  const showStream = active && !mediaHealthBad
  const showHttpRtc = HTTP_RTC_ENABLED && showStream && !httpRtcFailed
  const showHls = CAMERA_FALLBACK_MEDIA_ENABLED && showStream && httpRtcFailed && !hlsFailed
  const hasPaintedTransport = streamReady || httpRtcReady || hlsReady

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof document === 'undefined') return

    let intersecting = true
    const recompute = () => {
      dispatchPlayback({
        type: 'sync-active',
        active: enabled && document.visibilityState === 'visible' && intersecting,
        now: Date.now(),
      })
    }
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
    if (!active) return
    const timeout = window.setTimeout(() => {
      dispatchPlayback({ type: 'start-timeout' })
    }, STREAM_START_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [active, streamNonce])

  useEffect(() => {
    if (!active || hasPaintedTransport) return
    const refresh = window.setInterval(() => {
      dispatchPlayback({ type: 'refresh-snapshot', now: Date.now() })
    }, SNAPSHOT_REFRESH_MS)
    return () => window.clearInterval(refresh)
  }, [active, hasPaintedTransport])

  useEffect(() => {
    if (!showHttpRtc) return

    const video = rtcVideoRef.current
    if (!video || typeof RTCPeerConnection === 'undefined') {
      dispatchPlayback({ type: 'http-rtc-unsupported' })
      return
    }

    let cancelled = false
    let painted = false
    const metricsWindow = window as Window & {
      __cayleyCameraLastRtcDegradedReason?: string | null
      __cayleyCameraMetrics?: CameraPlaybackMetrics
    }
    let rtcStats: Partial<CameraPlaybackMetrics> = {}
    let startedAtMs = Date.now()
    let lastHealthSample: {
      atMs: number
      videoTimeSec: number
      videoDroppedFrames: number | null
      videoTotalFrames: number | null
      rtcFramesDecoded: number | null
      rtcFramesDropped: number | null
      rtcPacketsLost: number | null
      rtcPacketsReceived: number | null
    } | null = null
    let badHealthSamples = 0
    let degradedReason: string | null = null
    let failing = false
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
    const sampleRtcStats = async () => {
      try {
        const report = await pc.getStats()
        if (cancelled) return
        const nextStats: Partial<CameraPlaybackMetrics> = {}
        report.forEach((raw) => {
          const stat = raw as RTCStats & Record<string, unknown>
          if (
            stat.type === 'inbound-rtp' &&
            (stat.kind === 'video' || stat.mediaType === 'video')
          ) {
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
            (stat.selected === true || (stat.nominated === true && stat.state === 'succeeded'))
          ) {
            nextStats.rtcCurrentRoundTripTimeSec = rounded(stat.currentRoundTripTime, 4)
            nextStats.rtcAvailableIncomingBitrate = rounded(stat.availableIncomingBitrate, 0)
          }
        })
        rtcStats = nextStats
        publishMetrics()
      } catch {
        // Stats are advisory; playback health is driven by the video element.
      }
    }
    const playbackQuality = () => {
      const getQuality = video.getVideoPlaybackQuality
      if (typeof getQuality !== 'function') return {}
      const quality = getQuality.call(video)
      return {
        videoCorruptedFrames: rounded(quality.corruptedVideoFrames, 0),
        videoDroppedFrames: rounded(quality.droppedVideoFrames, 0),
        videoTotalFrames: rounded(quality.totalVideoFrames, 0),
      }
    }
    const evaluateRtcHealth = (metrics: CameraPlaybackMetrics) => {
      if (failing) return
      if (!painted || Date.now() - startedAtMs < HTTP_RTC_HEALTH_GRACE_MS) return

      const next = {
        atMs: Date.now(),
        videoTimeSec: metrics.videoTimeSec,
        videoDroppedFrames: metrics.videoDroppedFrames ?? null,
        videoTotalFrames: metrics.videoTotalFrames ?? null,
        rtcFramesDecoded: metrics.rtcFramesDecoded ?? null,
        rtcFramesDropped: metrics.rtcFramesDropped ?? null,
        rtcPacketsLost: metrics.rtcPacketsLost ?? null,
        rtcPacketsReceived: metrics.rtcPacketsReceived ?? null,
      }
      if (!lastHealthSample) {
        lastHealthSample = next
        return
      }

      const elapsedSec = Math.max(0.001, (next.atMs - lastHealthSample.atMs) / 1000)
      if (elapsedSec < HTTP_RTC_HEALTH_SAMPLE_MS / 1000) return

      const progressRatio = (next.videoTimeSec - lastHealthSample.videoTimeSec) / elapsedSec
      const videoDroppedDelta =
        next.videoDroppedFrames != null && lastHealthSample.videoDroppedFrames != null
          ? next.videoDroppedFrames - lastHealthSample.videoDroppedFrames
          : null
      const videoTotalDelta =
        next.videoTotalFrames != null && lastHealthSample.videoTotalFrames != null
          ? next.videoTotalFrames - lastHealthSample.videoTotalFrames
          : null
      const rtcFramesDecodedDelta =
        next.rtcFramesDecoded != null && lastHealthSample.rtcFramesDecoded != null
          ? next.rtcFramesDecoded - lastHealthSample.rtcFramesDecoded
          : null
      const rtcFramesDroppedDelta =
        next.rtcFramesDropped != null && lastHealthSample.rtcFramesDropped != null
          ? next.rtcFramesDropped - lastHealthSample.rtcFramesDropped
          : null
      const packetLostDelta =
        next.rtcPacketsLost != null && lastHealthSample.rtcPacketsLost != null
          ? next.rtcPacketsLost - lastHealthSample.rtcPacketsLost
          : null
      const packetReceivedDelta =
        next.rtcPacketsReceived != null && lastHealthSample.rtcPacketsReceived != null
          ? next.rtcPacketsReceived - lastHealthSample.rtcPacketsReceived
          : null

      const videoDropRatio =
        videoDroppedDelta != null && videoTotalDelta != null && videoTotalDelta > 0
          ? videoDroppedDelta / videoTotalDelta
          : null
      const rtcFrameDropRatio =
        rtcFramesDroppedDelta != null &&
        rtcFramesDecodedDelta != null &&
        rtcFramesDecodedDelta + rtcFramesDroppedDelta > 0
          ? rtcFramesDroppedDelta / (rtcFramesDecodedDelta + rtcFramesDroppedDelta)
          : null
      const packetLossRatio =
        packetLostDelta != null && packetReceivedDelta != null && packetReceivedDelta + packetLostDelta > 0
          ? packetLostDelta / (packetReceivedDelta + packetLostDelta)
          : 0

      let reason: string | null = null
      if (progressRatio < HTTP_RTC_MIN_PROGRESS_RATIO) reason = 'slow_playback'
      else if (
        rtcFrameDropRatio != null
          ? rtcFrameDropRatio > HTTP_RTC_MAX_VIDEO_DROP_RATIO
          : (videoDropRatio ?? 0) > HTTP_RTC_MAX_VIDEO_DROP_RATIO
      ) reason = 'video_drops'
      else if (
        packetLossRatio > HTTP_RTC_MAX_PACKET_LOSS_RATIO &&
        (rtcFrameDropRatio ?? videoDropRatio ?? 0) > HTTP_RTC_PACKET_LOSS_FRAME_DROP_RATIO
      ) reason = 'packet_loss'

      if (reason) {
        badHealthSamples += 1
        degradedReason = reason
      } else {
        badHealthSamples = 0
        degradedReason = null
      }

      lastHealthSample = next
      if (badHealthSamples >= HTTP_RTC_BAD_SAMPLE_LIMIT) {
        fail(degradedReason || 'unstable_rtc')
      }
    }
    const publishMetrics = () => {
      const nextMetrics: CameraPlaybackMetrics = {
        mode: 'rtc',
        readyState: video.readyState,
        videoWidth: video.videoWidth || null,
        videoHeight: video.videoHeight || null,
        videoTimeSec: Number(video.currentTime.toFixed(3)),
        bufferedAheadSec: null,
        hlsLatencySec: null,
        hlsEdgeSec: null,
        hlsTargetLatencySec: null,
        hlsMaxLatencySec: null,
        liveSyncPositionSec: null,
        playbackRate: Number(video.playbackRate.toFixed(3)),
        updatedAtMs: Date.now(),
        ...playbackQuality(),
        rtcConnectionState: pc.connectionState,
        rtcIceConnectionState: pc.iceConnectionState,
        rtcDegradedReason: degradedReason,
        ...rtcStats,
      }
      metricsWindow.__cayleyCameraMetrics = nextMetrics
      dispatchPlayback({ type: 'metrics', metrics: nextMetrics })
      evaluateRtcHealth(nextMetrics)
    }
    const markLive = () => {
      if (cancelled) return
      painted = true
      startedAtMs = Date.now()
      lastHealthSample = null
      badHealthSamples = 0
      degradedReason = null
      metricsWindow.__cayleyCameraLastRtcDegradedReason = null
      publishMetrics()
      dispatchPlayback({ type: 'http-rtc-live' })
    }
    const fail = (reason?: string) => {
      if (cancelled || failing) return
      failing = true
      degradedReason = reason || degradedReason
      metricsWindow.__cayleyCameraLastRtcDegradedReason = degradedReason
      publishMetrics()
      const hlsPainted = (videoRef.current?.readyState ?? 0) >= 2
      dispatchPlayback({ type: 'http-rtc-failed', hlsPainted })
    }
    const onVideoError = () => fail('video_error')
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
    video.addEventListener('error', onVideoError)

    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addEventListener('track', (event) => {
      const stream = event.streams[0] || new MediaStream([event.track])
      video.srcObject = stream
      video.play().catch(() => undefined)
    })
    pc.addEventListener('connectionstatechange', () => {
      publishMetrics()
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        fail()
      }
    })
    pc.addEventListener('iceconnectionstatechange', () => {
      publishMetrics()
      if (pc.iceConnectionState === 'failed') fail()
    })

    const startTimeout = window.setTimeout(() => {
      if (!painted) fail()
    }, HTTP_RTC_START_TIMEOUT_MS)
    const metricsTimer = window.setInterval(() => {
      publishMetrics()
      void sampleRtcStats()
    }, 1_000)

    const start = async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGatheringComplete(pc, HTTP_RTC_ICE_GATHER_TIMEOUT_MS)
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
        publishMetrics()
        void sampleRtcStats()
      } catch {
        fail()
      }
    }

    start()

    return () => {
      cancelled = true
      window.clearTimeout(startTimeout)
      window.clearInterval(metricsTimer)
      video.removeEventListener('loadeddata', markLive)
      video.removeEventListener('playing', markLive)
      video.removeEventListener('error', onVideoError)
      video.srcObject = null
      closePeer()
      if (metricsWindow.__cayleyCameraMetrics?.mode === 'rtc') {
        delete metricsWindow.__cayleyCameraMetrics
      }
      dispatchPlayback({ type: 'metrics', metrics: null })
    }
  }, [showHttpRtc, webrtcOfferUrl])

  useEffect(() => {
    if (!showHls) return

    const video = videoRef.current
    if (!video) return

    let cancelled = false
    let painted = false
    let hls: {
      destroy: () => void
      startLoad?: (startPosition?: number) => void
      recoverMediaError?: () => void
      liveSyncPosition?: number | null
    } | null = null
    let recoverAttempts = 0
    let liveEdgeTimer: number | null = null
    const metricsWindow = window as Window & {
      __cayleyCameraLastRtcDegradedReason?: string | null
      __cayleyCameraMetrics?: CameraPlaybackMetrics
    }
    const finiteNumber = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null
    const rounded = (value: unknown, places = 3): number | null => {
      const n = finiteNumber(value)
      return n == null ? null : Number(n.toFixed(places))
    }
    const bufferedAhead = () => {
      const ranges = video.buffered
      if (!ranges.length) return null
      const end = ranges.end(ranges.length - 1)
      return Number.isFinite(end) ? Math.max(0, end - video.currentTime) : null
    }
    const publishMetrics = () => {
      const rtcVideo = rtcVideoRef.current
      if (
        rtcVideo &&
        rtcVideo.readyState >= 2 &&
        typeof window !== 'undefined' &&
        window.getComputedStyle(rtcVideo).opacity !== '0'
      ) {
        return
      }
      const hlsState = hls as ({
        latency?: number
        targetLatency?: number | null
        maxLatency?: number
        liveSyncPosition?: number | null
        latestLevelDetails?: {
          age?: number
          edge?: number
        } | null
      } | null)
      const levelEdge = finiteNumber(hlsState?.latestLevelDetails?.edge)
      const levelAge = finiteNumber(hlsState?.latestLevelDetails?.age) ?? 0
      const estimatedLatency = levelEdge == null ? null : levelEdge + levelAge - video.currentTime
      const hlsLatency = finiteNumber(hlsState?.latency)
      metricsWindow.__cayleyCameraMetrics = {
        mode: 'hls',
        readyState: video.readyState,
        videoWidth: video.videoWidth || null,
        videoHeight: video.videoHeight || null,
        videoTimeSec: Number(video.currentTime.toFixed(3)),
        bufferedAheadSec: finiteNumber(bufferedAhead()),
        hlsLatencySec: hlsLatency && hlsLatency > 0 ? hlsLatency : finiteNumber(estimatedLatency),
        hlsEdgeSec: levelEdge == null ? null : levelEdge + levelAge,
        hlsTargetLatencySec: finiteNumber(hlsState?.targetLatency),
        hlsMaxLatencySec: finiteNumber(hlsState?.maxLatency),
        liveSyncPositionSec: finiteNumber(hlsState?.liveSyncPosition),
        playbackRate: Number(video.playbackRate.toFixed(3)),
        updatedAtMs: Date.now(),
        rtcDegradedReason: metricsWindow.__cayleyCameraLastRtcDegradedReason || null,
      }
      const getQuality = video.getVideoPlaybackQuality
      if (typeof getQuality === 'function') {
        const quality = getQuality.call(video)
        metricsWindow.__cayleyCameraMetrics.videoCorruptedFrames = rounded(quality.corruptedVideoFrames, 0)
        metricsWindow.__cayleyCameraMetrics.videoDroppedFrames = rounded(quality.droppedVideoFrames, 0)
        metricsWindow.__cayleyCameraMetrics.videoTotalFrames = rounded(quality.totalVideoFrames, 0)
      }
      dispatchPlayback({ type: 'metrics', metrics: metricsWindow.__cayleyCameraMetrics })
    }

    const markLive = () => {
      if (cancelled) return
      painted = true
      publishMetrics()
      dispatchPlayback({ type: 'hls-live' })
    }
    const fail = () => {
      if (cancelled) return
      const rtcPainted = (rtcVideoRef.current?.readyState ?? 0) >= 2
      dispatchPlayback({ type: 'hls-failed', rtcPainted })
    }

    video.muted = true
    video.playsInline = true
    video.addEventListener('loadeddata', markLive)
    video.addEventListener('playing', markLive)
    video.addEventListener('error', fail)

    const play = () => video.play().catch(() => undefined)
    const followLiveEdge = () => {
      if (cancelled || video.paused || video.readyState < 2) {
        publishMetrics()
        return
      }
      const hlsState = hls as ({ latency?: number; liveSyncPosition?: number | null } | null)
      const hlsLatency = finiteNumber(hlsState?.latency)
      const liveSyncPosition = finiteNumber(hlsState?.liveSyncPosition)
      const seekable = video.seekable
      const liveEnd = liveSyncPosition ??
        (seekable.length > 0 ? seekable.end(seekable.length - 1) : null)
      if (liveEnd == null || !Number.isFinite(liveEnd) || liveEnd <= 0) {
        publishMetrics()
        return
      }
      const drift = hlsLatency && hlsLatency > 0 ? hlsLatency : liveEnd - video.currentTime
      const forwardBuffer = bufferedAhead()
      if (
        drift > LIVE_EDGE_HARD_DRIFT_SEC &&
        forwardBuffer != null &&
        forwardBuffer > LIVE_EDGE_MIN_CATCHUP_BUFFER_SEC
      ) {
        video.currentTime = Math.max(0, liveEnd - LIVE_EDGE_TARGET_SEC)
        video.playbackRate = 1
      } else if (
        drift > LIVE_EDGE_SOFT_DRIFT_SEC &&
        forwardBuffer != null &&
        forwardBuffer > LIVE_EDGE_MIN_CATCHUP_BUFFER_SEC
      ) {
        video.playbackRate = LIVE_EDGE_CATCHUP_RATE
      } else if (video.playbackRate !== 1) {
        video.playbackRate = 1
      }
      publishMetrics()
    }
    const startTimeout = window.setTimeout(() => {
      if (!painted) fail()
    }, STREAM_START_TIMEOUT_MS)
    liveEdgeTimer = window.setInterval(followLiveEdge, 1_000)

    const startNativeHls = () => {
      video.src = hlsUrl
      video.load()
      play()
    }

    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return
        if (!Hls.isSupported()) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            startNativeHls()
          } else {
            fail()
          }
          return
        }
        const instance = new Hls({
          lowLatencyMode: true,
          liveSyncDuration: LIVE_EDGE_TARGET_SEC,
          liveMaxLatencyDuration: LIVE_EDGE_HARD_DRIFT_SEC,
          maxLiveSyncPlaybackRate: LIVE_EDGE_CATCHUP_RATE,
          maxBufferLength: 6,
          maxMaxBufferLength: 8,
          backBufferLength: 1,
          manifestLoadingTimeOut: 5_000,
          levelLoadingTimeOut: 5_000,
          fragLoadingTimeOut: 6_000,
          nudgeOffset: 0.05,
          nudgeMaxRetry: 5,
        })
        hls = instance
        instance.loadSource(hlsUrl)
        instance.attachMedia(video)
        instance.on(Hls.Events.MANIFEST_PARSED, play)
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!data?.fatal) return
          if (recoverAttempts < 3) {
            recoverAttempts += 1
            dispatchPlayback({ type: 'hls-recovering' })
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              instance.recoverMediaError()
            } else {
              instance.startLoad(-1)
            }
            return
          }
          fail()
        })
      })
      .catch(() => {
        if (cancelled) return
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          startNativeHls()
        } else {
          fail()
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(startTimeout)
      if (liveEdgeTimer != null) window.clearInterval(liveEdgeTimer)
      video.removeEventListener('loadeddata', markLive)
      video.removeEventListener('playing', markLive)
      video.removeEventListener('error', fail)
      dispatchPlayback({ type: 'hls-cleanup' })
      video.playbackRate = 1
      if (metricsWindow.__cayleyCameraMetrics?.mode === 'hls') {
        delete metricsWindow.__cayleyCameraMetrics
      }
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [hlsUrl, showHls])

  useEffect(() => {
    if (!CAMERA_FALLBACK_MEDIA_ENABLED || !showStream || !hlsFailed || httpRtcReady) return
    const retry = window.setTimeout(() => {
      dispatchPlayback({ type: 'retry-hls' })
    }, Math.min(30_000, HLS_RETRY_MS * Math.max(1, hlsRetryCount)))
    return () => window.clearTimeout(retry)
  }, [hlsFailed, hlsRetryCount, httpRtcReady, showStream])

  useEffect(() => {
    if (!active) return
    if (mediaHealthBad) {
      dispatchPlayback({ type: 'media-offline' })
      return
    }
    if (snapshotReady) {
      dispatchPlayback({ type: 'snapshot-preview', canPreview: true })
    }
  }, [active, mediaHealthBad, snapshotReady])

  const reload = () => {
    dispatchPlayback({ type: 'reload', now: Date.now() })
  }

  const streamActive = hasPaintedTransport && phase !== 'paused' && phase !== 'offline'

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
          dispatchPlayback({ type: 'snapshot-live' })
          dispatchPlayback({ type: 'snapshot-preview', canPreview: active && !mediaHealthBad })
        }}
        onError={() => {
          dispatchPlayback({ type: 'snapshot-error', hasPaintedTransport })
        }}
        style={{
          objectFit: fit,
          objectPosition: position,
          opacity: 1,
          transition: 'none',
          filter: phase === 'offline' ? 'saturate(0.84) brightness(0.7)' : 'saturate(1.02) contrast(1.03)',
        }}
      />

      {showHttpRtc && (
        <video
          ref={rtcVideoRef}
          muted
          playsInline
          autoPlay
          aria-label="Cayley field camera WebRTC live preview"
          className="absolute inset-0 h-full w-full"
          style={{
            objectFit: fit,
            objectPosition: position,
            opacity: streamActive && httpRtcReady ? 1 : 0,
            transition: 'none',
          }}
        />
      )}

      {showHls && (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label="Cayley field camera clean live preview"
          className="absolute inset-0 h-full w-full"
          style={{
            objectFit: fit,
            objectPosition: position,
            opacity: streamActive && !httpRtcReady ? 1 : 0,
            transition: 'none',
          }}
        />
      )}

      {CAMERA_FALLBACK_MEDIA_ENABLED && showStream && hlsFailed && !httpRtcReady && (
        <img
          key={streamNonce}
          src={mjpegUrl}
          alt=""
          aria-label="Cayley field camera clean live preview"
          className="absolute inset-0 h-full w-full"
          onLoad={() => {
            dispatchPlayback({ type: 'video-live' })
          }}
          onError={() => {
            dispatchPlayback({ type: 'video-error', canPreview: snapshotReady && !mediaHealthBad })
          }}
          style={{
            objectFit: fit,
            objectPosition: position,
            opacity: streamActive ? 1 : 0,
            transition: 'none',
          }}
        />
      )}

      {phase === 'connecting' && !snapshotReady && <FeedShimmer label="opening clean preview..." isLight={isLight} />}
      {phase === 'paused' && <FeedPaused />}
      {phase === 'offline' && <FeedOffline isLight={isLight} onRetry={reload} />}

      {(phase === 'preview' || phase === 'live') && <LiveBadge phase={phase} quality={quality} />}
      {(phase === 'preview' || phase === 'live') && <CameraSpecsOverlay data={overlay} quality={quality} metrics={playbackMetrics} />}
      {phase === 'live' && <DetectionOverlay data={detections} layout={videoLayout} />}
      {(phase === 'preview' || phase === 'live') && <TrainingStatusPill data={training} />}
      {debugMode && <DevHUD phase={phase} quality={quality} />}

      <style>{`
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
        .field-detection-box {
          border-color: #34d399;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.45), 0 0 16px rgba(52,211,153,0.35);
        }
      `}</style>
    </div>
  )
}

function withQueryParams(url: string, params: Record<string, string | number>): string {
  const queryIndex = url.indexOf('?')
  const base = queryIndex === -1 ? url : url.slice(0, queryIndex)
  const existingQuery = queryIndex === -1 ? '' : url.slice(queryIndex + 1)
  const nextQuery = new URLSearchParams(existingQuery)

  Object.entries(params).forEach(([key, value]) => {
    nextQuery.set(key, String(value))
  })

  const query = nextQuery.toString()
  return query ? `${base}?${query}` : base
}

function isConfirmedCameraBad(quality: CameraQuality): boolean {
  if (quality.snapshot?.stale === true) return true
  if (typeof quality.sanitizer?.latest_clean_age_s === 'number' && quality.sanitizer.latest_clean_age_s > STALE_CLEAN_FRAME_SEC) {
    return true
  }
  if (quality.ok === false && !quality.error) {
    const cleanFresh =
      quality.snapshot?.stale === false ||
      (typeof quality.sanitizer?.latest_clean_age_s === 'number' &&
        quality.sanitizer.latest_clean_age_s <= STALE_CLEAN_FRAME_SEC)
    if (quality.sanitizer?.hls_ok === false && cleanFresh) return false
    return true
  }
  return false
}

function useCameraQuality(enabled: boolean): CameraQuality {
  const lastSampleRef = useRef<QualityRateSample | null>(null)
  const [data, setData] = useState<CameraQuality>({})

  useEffect(() => {
    if (!enabled) {
      lastSampleRef.current = null
      return
    }

    let cancelled = false
    let ctrl: AbortController | null = null

    const poll = async () => {
      ctrl?.abort()
      ctrl = new AbortController()
      let next: CameraQuality
      try {
        const res = await fetchWithTimeout(QUALITY_URL, { signal: ctrl.signal, cache: 'no-store' }, 4_000)
        if (!res.ok) {
          next = { ok: false, error: `quality_${res.status}` }
        } else {
          next = await res.json() as CameraQuality
          const hlsFramesWritten = next.sanitizer?.hls_frames_written
          if (typeof hlsFramesWritten === 'number' && Number.isFinite(hlsFramesWritten)) {
            const ts = Date.now()
            const last = lastSampleRef.current
            if (last && hlsFramesWritten >= last.hlsFramesWritten) {
              const elapsedS = Math.max(0.001, (ts - last.ts) / 1000)
              const fps = (hlsFramesWritten - last.hlsFramesWritten) / elapsedS
              next.sanitizer = {
                ...next.sanitizer,
                observed_hls_fps: Number.isFinite(fps) ? fps : null,
              }
            }
            lastSampleRef.current = { ts, hlsFramesWritten }
          } else {
            lastSampleRef.current = null
          }
        }
      } catch {
        next = { ok: false, error: 'quality_unreachable' }
      }
      if (!cancelled) setData(next)
    }

    poll()
    const timer = window.setInterval(poll, 2_000)
    return () => {
      cancelled = true
      ctrl?.abort()
      window.clearInterval(timer)
    }
  }, [enabled])

  return enabled ? data : {}
}

function useCameraHealthOverlay(enabled: boolean): CameraHealthOverlay {
  const [data, setData] = useState<CameraHealthOverlay>({})

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let ctrl: AbortController | null = null

    const poll = async () => {
      ctrl?.abort()
      ctrl = new AbortController()
      const next: CameraHealthOverlay = {}
      try {
        const healthRes = await fetchWithTimeout(HEALTH_URL, { signal: ctrl.signal, cache: 'no-store' }, 6_000)
        if (healthRes.ok) {
          const health = (await healthRes.json()) as HealthPayload
          const media = health.system?.media_graph
          next.outputSize = media?.output_size
          next.profile = media?.stream_profile
        }
      } catch {
        // Overlay is informational only.
      }
      if (!cancelled) setData(next)
    }

    poll()
    const timer = window.setInterval(poll, 10_000)
    return () => {
      cancelled = true
      ctrl?.abort()
      window.clearInterval(timer)
    }
  }, [enabled])

  return enabled ? data : {}
}

function useDetectionOverlay(enabled: boolean): DetectionPayload {
  const [data, setData] = useState<DetectionPayload>({})

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let ctrl: AbortController | null = null

    const poll = async () => {
      ctrl?.abort()
      ctrl = new AbortController()
      let next: DetectionPayload = {}
      try {
        const res = await fetchWithTimeout(DETECTIONS_POLL_URL, { signal: ctrl.signal, cache: 'no-store' }, 4_000)
        if (res.ok) next = await res.json() as DetectionPayload
      } catch {
        next = { error: 'unreachable' }
      }
      if (!cancelled) setData(next)
    }

    poll()
    const timer = window.setInterval(poll, 2_000)
    return () => {
      cancelled = true
      ctrl?.abort()
      window.clearInterval(timer)
    }
  }, [enabled])

  return enabled ? data : {}
}

function useTrainingStatus(enabled: boolean): TrainingStatus {
  const [data, setData] = useState<TrainingStatus>({})

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let ctrl: AbortController | null = null

    const poll = async () => {
      ctrl?.abort()
      ctrl = new AbortController()
      let next: TrainingStatus
      try {
        const res = await fetchWithTimeout(TRAINING_STATUS_URL, { signal: ctrl.signal, cache: 'no-store' }, 6_000)
        next = res.ok
          ? await res.json() as TrainingStatus
          : { ok: false, error: `training_${res.status}` }
      } catch {
        next = { ok: false, error: 'training_unreachable' }
      }
      if (!cancelled) setData(next)
    }

    poll()
    const timer = window.setInterval(poll, 15_000)
    return () => {
      cancelled = true
      ctrl?.abort()
      window.clearInterval(timer)
    }
  }, [enabled])

  return enabled ? data : {}
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
          animation: 'fldLivePulse 0.9s cubic-bezier(0.4,0,0.6,1) infinite',
        }}
      />
      {label}{dropped > 0 ? ` · ${dropped} drops` : ''}
    </div>
  )
}

function CameraSpecsOverlay({
  data,
  quality,
  metrics,
}: {
  data: CameraHealthOverlay
  quality: CameraQuality
  metrics: CameraPlaybackMetrics | null
}) {
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
  const cleanOutput = quality.sanitizer?.width && quality.sanitizer?.height
    ? `${quality.sanitizer.width}x${quality.sanitizer.height}`
    : null
  const measuredOutput = metrics?.videoWidth && metrics.videoHeight
    ? `${metrics.videoWidth}x${metrics.videoHeight}`
    : null
  const measuredFps = typeof metrics?.rtcFramesPerSecond === 'number'
    ? `${formatFps(metrics.rtcFramesPerSecond)}fps actual`
    : typeof quality.sanitizer?.observed_hls_fps === 'number'
      ? `${formatFps(quality.sanitizer.observed_hls_fps)}fps hls`
      : null
  const dropText = typeof metrics?.videoDroppedFrames === 'number' && metrics.videoDroppedFrames > 0
    ? `${metrics.videoDroppedFrames} dropped`
    : typeof metrics?.rtcFramesDropped === 'number' && metrics.rtcFramesDropped > 0
      ? `${metrics.rtcFramesDropped} rtc drops`
      : null
  const networkText = metrics?.mode === 'rtc' && typeof metrics.rtcCurrentRoundTripTimeSec === 'number'
    ? `${Math.round(metrics.rtcCurrentRoundTripTimeSec * 1000)}ms rtt`
    : metrics?.mode === 'hls' && typeof metrics.hlsLatencySec === 'number'
      ? `${metrics.hlsLatencySec.toFixed(1)}s latency`
      : null
  const targetFps = typeof quality.sanitizer?.fps_target === 'number' && quality.sanitizer.fps_target > 0
    ? `${formatFps(quality.sanitizer.fps_target)}fps target`
    : null
  const staleClean = typeof quality.sanitizer?.latest_clean_age_s === 'number' &&
    quality.sanitizer.latest_clean_age_s > STALE_CLEAN_FRAME_SEC
    ? 'stale'
    : null
  const transport = quality.sanitizer?.framed_udp_listen
    ? `udp${(quality.sanitizer?.framed_udp_fec_packets ?? 0) > 0 ? '+fec' : ''}`
    : null
  const fecRecovered = quality.sanitizer?.framed_udp_fec_recovered && quality.sanitizer.framed_udp_fec_recovered > 0
    ? `${quality.sanitizer.framed_udp_fec_recovered} recovered`
    : null
  const cleanDrops = (quality.sanitizer?.frames_dropped_green ?? 0) + (quality.sanitizer?.frames_dropped_encode ?? 0)
  const hlsDrops = quality.sanitizer?.hls_frames_dropped ?? 0
  const cleanRestart = quality.sanitizer?.ffmpeg_restarts && quality.sanitizer.ffmpeg_restarts > 1
    ? `${quality.sanitizer.ffmpeg_restarts} restarts`
    : null
  const cleanParts = [
    measuredOutput,
    measuredFps,
    cleanOutput && cleanOutput !== measuredOutput ? cleanOutput : null,
    measuredFps ? null : targetFps,
    metrics?.mode,
    dropText,
    networkText,
    transport,
    fecRecovered,
    quality.mode === 'sanitized-preview' || quality.snapshot?.source === 'sanitized' ? 'sanitized' : null,
    cleanDrops > 0 ? `${cleanDrops} drops` : null,
    hlsDrops > 0 ? `${hlsDrops} hls drops` : null,
    cleanRestart,
    staleClean,
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
  const withAge = recent.reduce<Array<{ item: DetectionItem; age: number }>>((acc, item) => {
    if (typeof item.ts === 'number') {
      acc.push({ item, age: Math.max(0, now - item.ts) })
    }
    return acc
  }, []).sort((a, b) => (a.item.ts ?? 0) - (b.item.ts ?? 0))
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
        {boxes.map(({ item, age }) => {
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
              key={`${item.ts ?? 'recent'}-${item.class ?? 'object'}-${left.toFixed(2)}-${top.toFixed(2)}-${width.toFixed(2)}-${height.toFixed(2)}`}
              className="field-detection-box pointer-events-none absolute rounded-[6px] border"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                opacity,
                borderStyle: boxFresh ? 'solid' : 'dashed',
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

function TrainingStatusPill({ data }: { data: TrainingStatus }) {
  if (!data.state && !data.error) return null

  const ready = data.training_ready || data.dataset_ready || data.state === 'ready_to_train'
  const unavailable = data.ok === false || Boolean(data.error)
  const label = trainingStateLabel(data)
  const qualityLabel = trainingQualityLabel(data)
  const progress = trainingProgressChips(data)
  const detail = progress.length > 0 ? null : trainingDetail(data)
  const waitLine = trainingWaitLine(data)
  const focusLine = trainingFocusLine(data)
  const dot = ready ? '#34d399' : unavailable ? '#f87171' : '#f59e0b'
  const background = ready
    ? 'rgba(6,78,59,0.76)'
    : unavailable
      ? 'rgba(127,29,29,0.72)'
      : 'rgba(92,52,13,0.76)'
  const color = ready ? '#bbf7d0' : unavailable ? '#fecaca' : '#fed7aa'

  return (
    <div
      className="pointer-events-none absolute bottom-11 left-3 right-3 flex max-w-[calc(100%-1.5rem)] flex-col gap-1 rounded-[8px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] sm:left-auto sm:max-w-[32rem]"
      style={{
        background,
        color,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: dot,
            boxShadow: `0 0 8px ${dot}`,
          }}
        />
        <span className="shrink-0 whitespace-nowrap">AI · {qualityLabel || label}</span>
        {detail && <span className="min-w-0 truncate opacity-80">{detail}</span>}
      </div>
      {(progress.length > 0 || waitLine || focusLine) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 opacity-80">
          {progress.map((item) => (
            <span key={item.label} className="whitespace-nowrap">
              {item.label} {item.value}
            </span>
          ))}
          {waitLine && <span className="min-w-0 truncate opacity-75">{waitLine}</span>}
          {focusLine && <span className="min-w-0 truncate opacity-75">{focusLine}</span>}
        </div>
      )}
    </div>
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
        animation: 'fldShimmer 0.9s linear infinite',
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
        animation: dim ? undefined : 'fldPlaceholderPulse 0.9s ease-in-out infinite',
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

function trainingStateLabel(data: TrainingStatus): string {
  if (data.error) return 'unavailable'
  if (data.training_ready || data.dataset_ready || data.state === 'ready_to_train') return 'ready'
  if (data.collection_wait?.guided_progress?.status === 'collecting') return 'collecting'
  if (
    isDuplicateStalled(data.collection_wait?.guided_progress) ||
    isDuplicateStalled(data.collection_wait?.preflight_progress) ||
    data.collection_wait?.status === 'guided_failed'
  ) return 'move targets'

  switch (data.state) {
    case 'waiting_for_scene':
      return 'move targets'
    case 'waiting_for_labels':
      return 'review labels'
    default:
      return (data.state || 'checking').replace(/_/g, ' ')
  }
}

function trainingQualityLabel(data: TrainingStatus): string | null {
  if (data.error) return 'offline'
  if (data.training_ready || data.dataset_ready || data.production_readiness?.ok) return 'training ready'

  const readiness = data.production_readiness
  const diversity = readiness?.image_diversity
  const classCount = Object.keys(readiness?.nonzero_classes ?? {}).length
  const unique = numericValue(diversity?.unique_images)
  const total = numericValue(readiness?.total_images)
  const duplicateRatio = numericValue(data.collection_wait?.guided_progress?.duplicate_ratio)

  if (classCount > 0 && classCount < 2) return `${classCount} class only`
  if (unique != null && total != null && total > 0 && unique / total < 0.35) return `${unique}/${total} unique`
  if (duplicateRatio != null && duplicateRatio >= 0.8) return `${Math.round(duplicateRatio * 100)}% duplicates`
  if (data.state === 'waiting_for_labels') return 'needs review'
  return null
}

function trainingProgressChips(data: TrainingStatus): { label: string; value: string }[] {
  const readiness = data.production_readiness
  const plan = readiness?.collection_plan
  if (!readiness || !plan) return []

  const totalImages = numericValue(readiness.total_images)
  const labeledImages = numericValue(readiness.labeled_images)
  const totalLabels = numericValue(readiness.total_labels)
  const uniqueImages = numericValue(readiness.image_diversity?.unique_images)
  const classCount = Object.keys(readiness.nonzero_classes ?? {}).length

  return [
    progressChip('img', totalImages, numericValue(plan.min_new_images)),
    progressChip('labeled', labeledImages, numericValue(plan.min_new_labeled_images)),
    progressChip('labels', totalLabels, numericValue(plan.min_new_labels)),
    progressChip('unique', uniqueImages, numericValue(plan.min_new_unique_images)),
    progressChip('classes', classCount, numericValue(plan.min_new_classes)),
  ].filter((item): item is { label: string; value: string } => Boolean(item))
}

function progressChip(label: string, current: number | null, needed: number | null): { label: string; value: string } | null {
  if (current == null || needed == null || needed <= 0) return null
  return { label, value: `${formatProgressNumber(current)}/${formatProgressNumber(current + needed)}` }
}

function trainingWaitLine(data: TrainingStatus): string | null {
  const guided = data.collection_wait?.guided_progress
  if (guided?.available) {
    return collectionProgressLine(guided, 'collecting')
  }

  const preflight = data.collection_wait?.preflight_progress
  if (preflight?.available) {
    return collectionProgressLine(preflight, 'preflight')
  }

  const capture = data.collection_wait?.capture
  const collection = data.collection_wait?.status
    ? data.collection_wait.status.replace(/_/g, ' ')
    : null
  const duplicateCount = numericValue(capture?.duplicates)
  const kept = numericValue(capture?.kept)
  const attempts = numericValue(capture?.attempts)
  const pieces = [
    collection ? `collection ${collection}` : null,
    kept != null && attempts != null ? `${kept}/${attempts} kept` : null,
    duplicateCount != null && duplicateCount > 0 ? `${duplicateCount} dupes` : null,
  ].filter(Boolean)
  return pieces.length ? pieces.join(' · ') : null
}

function collectionProgressLine(progress: CollectionProgress, defaultStatus: string): string {
  const rawStatus = isDuplicateStalled(progress) ? 'stalled' : progress.status || defaultStatus
  const status = rawStatus.replace(/_/g, ' ')
  const kept = numericValue(progress.kept)
  const attempts = numericValue(progress.attempts)
  const duplicateRatio = numericValue(progress.duplicate_ratio)
  const duplicates = numericValue(progress.duplicates)
  const diverseRatio = numericValue(progress.diverse_attempt_ratio)
  const minDiverseRatio = numericValue(progress.min_diverse_attempt_ratio)
  const pieces = [
    kept != null && attempts != null ? `${status} ${kept}/${attempts} kept` : status,
    duplicateRatio != null
      ? `${Math.round(duplicateRatio * 100)}% dupes`
      : duplicates != null && duplicates > 0
        ? `${duplicates} dupes`
        : null,
    diverseRatio != null
      ? `${Math.round(diverseRatio * 100)}% diverse${minDiverseRatio != null ? `/${Math.round(minDiverseRatio * 100)}%` : ''}`
      : null,
  ].filter(Boolean)
  return pieces.join(' · ')
}

function trainingFocusLine(data: TrainingStatus): string | null {
  const focus = data.production_readiness?.collection_plan?.focus
  if (Array.isArray(focus) && focus.length > 0) return focus[0]
  const nextAction = data.model_wait?.latest_pipeline_status === 'not_training_ready'
    ? data.short_action || data.production_readiness?.short_action
    : null
  return nextAction || null
}

function numericValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isDuplicateStalled(progress?: CollectionProgress | null): boolean {
  if (!progress || typeof progress !== 'object') return false
  const duplicateRatio = numericValue(progress.duplicate_ratio)
  const diverseRatio = numericValue(progress.diverse_attempt_ratio)
  return (
    duplicateRatio != null &&
    duplicateRatio >= 0.8 &&
    (
      (progress.status === 'complete' &&
        (progress.session_status === 'failed' || progress.finish_reason === 'attempt_limit' || progress.finish_reason === 'duplicate_streak')) ||
      progress.status === 'not_ready_to_collect' ||
      (diverseRatio != null && diverseRatio <= 0.2)
    )
  )
}

function formatProgressNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function trainingDetail(data: TrainingStatus): string | null {
  const plan = data.production_readiness?.collection_plan
  if (plan) {
    const parts = [
      typeof plan.min_new_images === 'number' && plan.min_new_images > 0
        ? `${plan.min_new_images} images`
        : null,
      typeof plan.min_new_labeled_images === 'number' && plan.min_new_labeled_images > 0
        ? `${plan.min_new_labeled_images} labeled`
        : null,
      typeof plan.min_new_labels === 'number' && plan.min_new_labels > 0
        ? `${plan.min_new_labels} labels`
        : null,
      typeof plan.min_new_unique_images === 'number' && plan.min_new_unique_images > 0
        ? `${plan.min_new_unique_images} unique`
        : null,
      typeof plan.min_new_classes === 'number' && plan.min_new_classes > 0
        ? `${plan.min_new_classes} classes`
        : null,
    ].filter(Boolean)
    if (parts.length) return `need ${parts.slice(0, 3).join(' · ')}`
  }

  const capture = data.collection_wait?.capture
  if (data.state === 'waiting_for_scene' && capture) {
    const parts = [
      typeof capture.diverse_attempt_ratio === 'number'
        ? `${Math.round(capture.diverse_attempt_ratio * 100)}% diverse`
        : null,
      typeof capture.kept === 'number' && typeof capture.attempts === 'number'
        ? `${capture.kept}/${capture.attempts} kept`
        : null,
      typeof data.collection_wait?.preflight_count === 'number'
        ? `${data.collection_wait.preflight_count} checks`
        : null,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : null
  }

  const failures = data.model_wait?.readiness_failures
    ?.flatMap((failure) => {
      const text = humanizeReadinessFailure(failure)
      return text ? [text] : []
    })
    .slice(0, 2)
  if (failures?.length) return failures.join(' · ')

  const seed = data.label_seed
  if (seed && typeof seed.labeled_images === 'number' && typeof seed.total_images === 'number') {
    return `${seed.labeled_images}/${seed.total_images} seed images labeled`
  }
  return data.selected_dataset || null
}

function humanizeReadinessFailure(value?: string): string | null {
  if (!value) return null
  const minMatch = value.match(/^([a-z_]+):([0-9.]+)<([0-9.]+)$/)
  if (minMatch) {
    const [, rawKey, rawValue, rawMin] = minMatch
    const labels: Record<string, string> = {
      images: 'images',
      labeled_images: 'labeled',
      labels: 'labels',
      classes: 'classes',
      unique_images: 'unique',
      labeled_unique_images: 'labeled unique',
    }
    const label = labels[rawKey] || rawKey.replace(/_/g, ' ')
    return `${label} ${formatCompactNumber(rawValue)}/${formatCompactNumber(rawMin)}`
  }

  const maxMatch = value.match(/^([a-z_]+):([0-9.]+)>([0-9.]+)$/)
  if (maxMatch) {
    const [, rawKey, rawValue, rawMax] = maxMatch
    const label = rawKey.replace(/_/g, ' ')
    return `${label} ${formatCompactNumber(rawValue)}>${formatCompactNumber(rawMax)}`
  }

  return value.replace(/_/g, ' ')
}

function formatCompactNumber(value: string): string {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return value
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function formatFps(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatDetectionAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${Math.round(seconds / 60)}m`
}

function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    let done = false
    let timeoutId: number | null = null
    const finish = () => {
      if (done) return
      done = true
      pc.removeEventListener('icegatheringstatechange', onChange)
      if (timeoutId) window.clearTimeout(timeoutId)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    pc.addEventListener('icegatheringstatechange', onChange)
    timeoutId = window.setTimeout(finish, timeoutMs)
  })
}

function initialActive(): boolean {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'visible'
}

function useDebugFlag(): boolean {
  const [on] = useState(() => {
    if (typeof window === 'undefined') return false
    const url = new URL(window.location.href)
    return url.searchParams.get('debug') === '1'
  })
  return on
}
