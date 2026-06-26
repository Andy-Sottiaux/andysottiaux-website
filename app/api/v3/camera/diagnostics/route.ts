import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RELAY_BASE =
  process.env.V3_CAMERA_PUBLIC_RELAY_BASE ||
  process.env.NEXT_PUBLIC_V3_CAMERA_GATEWAY_HOST ||
  'https://cam1.andysottiaux.com'

type CheckResult = {
  ok: boolean
  status?: number
  latency_ms: number
  error?: string
  data?: unknown
}

type HealthPayload = {
  ok?: boolean
  service_count?: number
  services_down?: string[] | null
  system?: {
    media_graph?: {
      state?: string
      working?: boolean
      visual_quality?: string
      input_size?: string
      output_size?: string
      stream_profile?: {
        width?: number
        height?: number
        fps?: number
      }
    }
    rknn_detector?: {
      ok?: boolean
      state?: string
      actual_fps?: number
      duration_ms?: number
      age_s?: number
    }
  }
}

type QualityPayload = {
  ok?: boolean
  sanitizer?: {
    latest_clean_age_s?: number
    hls_ok?: boolean
    reason?: string
  }
}

type TrainingPayload = {
  ok?: boolean
  images?: number
  labels?: number
  classes?: number
  unique?: number
  kept?: number
}

function timeoutSignal(ms: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  return { controller, timeout }
}

function elapsed(start: number) {
  return Math.round(performance.now() - start)
}

async function readJsonCheck(url: string, timeoutMs = 6000): Promise<CheckResult> {
  const started = performance.now()
  const { controller, timeout } = timeoutSignal(timeoutMs)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'andysottiaux.com/camera-diagnostics' },
    })
    const data = await response.json().catch(() => null)
    return {
      ok: response.ok && typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok !== false,
      status: response.status,
      latency_ms: elapsed(started),
      data,
    }
  } catch (error) {
    return {
      ok: false,
      latency_ms: elapsed(started),
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function readImageCheck(url: string, timeoutMs = 8000): Promise<CheckResult> {
  const started = performance.now()
  const { controller, timeout } = timeoutSignal(timeoutMs)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'andysottiaux.com/camera-diagnostics' },
    })
    const contentType = response.headers.get('content-type') || ''
    const bytes = new Uint8Array(await response.arrayBuffer())
    const jpeg = bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8
    return {
      ok: response.ok && (jpeg || contentType.includes('image/jpeg')),
      status: response.status,
      latency_ms: elapsed(started),
      data: {
        bytes: bytes.length,
        content_type: contentType,
        jpeg,
      },
    }
  } catch (error) {
    return {
      ok: false,
      latency_ms: elapsed(started),
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function asObject<T>(check: CheckResult): T | null {
  if (!check.data || typeof check.data !== 'object') return null
  return check.data as T
}

export async function GET() {
  const base = RELAY_BASE.trim().replace(/\/+$/, '')
  const [health, quality, snapshot, training, detections] = await Promise.all([
    readJsonCheck(`${base}/api/health`),
    readJsonCheck(`${base}/api/camera/quality`),
    readImageCheck(`${base}/api/camera/sanitized.jpeg`),
    readJsonCheck(`${base}/api/training/status`),
    readJsonCheck(`${base}/api/detections`),
  ])

  const healthData = asObject<HealthPayload>(health)
  const qualityData = asObject<QualityPayload>(quality)
  const trainingData = asObject<TrainingPayload>(training)
  const media = healthData?.system?.media_graph
  const stream = media?.stream_profile
  const rknn = healthData?.system?.rknn_detector
  const resolution =
    stream?.width && stream.height
      ? `${stream.width}x${stream.height}`
      : media?.output_size || media?.input_size || null

  const checks = {
    relay: {
      ok: health.status === 200 || quality.status === 200,
      status: health.status ?? quality.status,
      latency_ms: Math.min(health.latency_ms || Number.MAX_SAFE_INTEGER, quality.latency_ms || Number.MAX_SAFE_INTEGER),
    },
    health,
    stream_config: {
      ok: health.ok && Boolean(media?.working !== false && (resolution || media?.state)),
      status: health.status,
      latency_ms: health.latency_ms,
      data: {
        state: media?.state ?? null,
        working: media?.working ?? null,
        visual_quality: media?.visual_quality ?? null,
        input_size: media?.input_size ?? null,
        output_size: media?.output_size ?? null,
        stream_profile: stream ?? null,
      },
    },
    sanitizer: quality,
    snapshot,
    training,
    detections,
  }

  const ok =
    checks.relay.ok &&
    health.ok &&
    checks.stream_config.ok &&
    quality.ok &&
    snapshot.ok &&
    training.ok &&
    detections.ok

  return NextResponse.json({
    ok,
    camera: 'cam1',
    checked_at: new Date().toISOString(),
    relay_base: base,
    summary: {
      resolution,
      fps: stream?.fps ?? null,
      visual_quality: media?.visual_quality ?? null,
      rknn_state: rknn?.state ?? null,
      rknn_fps: rknn?.actual_fps ?? null,
      rknn_latency_ms: rknn?.duration_ms ?? null,
      sanitizer_age_s: qualityData?.sanitizer?.latest_clean_age_s ?? null,
      sanitizer_hls_ok: qualityData?.sanitizer?.hls_ok ?? null,
      training_images: trainingData?.images ?? null,
      training_labels: trainingData?.labels ?? null,
      training_classes: trainingData?.classes ?? null,
      services_down: healthData?.services_down ?? [],
      services_total: healthData?.service_count ?? null,
    },
    checks,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
