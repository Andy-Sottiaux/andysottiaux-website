import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RELAY_BASE =
  process.env.V3_CAMERA_2_PUBLIC_RELAY_BASE ||
  'https://cam2.andysottiaux.com/api/camera2'

type CheckResult = {
  ok: boolean
  status?: number
  latency_ms: number
  error?: string
  data?: unknown
}

type MetricsPayload = {
  ok?: boolean
  stream0?: {
    width?: number
    height?: number
    fps?: number
    bitrate?: number
    rtsp_endpoint?: string
  } | null
  control?: {
    transport?: string
    mode?: string
  } | null
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
      headers: { 'User-Agent': 'andysottiaux.com/camera2-diagnostics' },
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

async function readSnapshotCheck(url: string, timeoutMs = 8000): Promise<CheckResult> {
  const started = performance.now()
  const { controller, timeout } = timeoutSignal(timeoutMs)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'andysottiaux.com/camera2-diagnostics' },
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

async function postStopCheck(url: string, timeoutMs = 5000): Promise<CheckResult> {
  const started = performance.now()
  const { controller, timeout } = timeoutSignal(timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'andysottiaux.com/camera2-diagnostics',
      },
      body: JSON.stringify({ command: 'stop' }),
    })
    const data = await response.json().catch(() => null)
    return {
      ok: response.ok && typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok === true,
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

function metricsPayload(check: CheckResult): MetricsPayload | null {
  const data = check.data
  if (!data || typeof data !== 'object') return null
  return data as MetricsPayload
}

export async function GET(request: NextRequest) {
  const activeControl = request.nextUrl.searchParams.get('active') === '1'
  const base = RELAY_BASE.trim().replace(/\/+$/, '')
  const [status, metrics, snapshot, activeControlCheck] = await Promise.all([
    readJsonCheck(`${base}/status`),
    readJsonCheck(`${base}/metrics`),
    readSnapshotCheck(`${base}/snapshot`),
    activeControl
      ? postStopCheck(`${base}/control`)
      : Promise.resolve<CheckResult>({
        ok: true,
        latency_ms: 0,
        data: { skipped: true, reason: 'pass active=1 to send a stop command' },
      }),
  ])

  const metricsData = metricsPayload(metrics)
  const stream = metricsData?.stream0
  const control = metricsData?.control
  const checks = {
    relay: {
      ok: status.status === 200 || metrics.status === 200,
      status: status.status ?? metrics.status,
      latency_ms: Math.min(status.latency_ms || Number.MAX_SAFE_INTEGER, metrics.latency_ms || Number.MAX_SAFE_INTEGER),
    },
    camera: status,
    stream_config: {
      ok: metrics.ok && Boolean(stream?.width && stream.height && stream.fps),
      status: metrics.status,
      latency_ms: metrics.latency_ms,
      data: stream ?? null,
    },
    snapshot,
    control: activeControlCheck,
    rtsp: {
      ok: null,
      latency_ms: 0,
      data: {
        endpoint: stream?.rtsp_endpoint ?? null,
        note: 'RTSP is validated locally by hatchingpoint-cam2-recover on cayley-relay.',
      },
    },
  }
  const ok = checks.relay.ok && status.ok && checks.stream_config.ok && snapshot.ok && activeControlCheck.ok

  return NextResponse.json({
    ok,
    camera: 'cam2',
    checked_at: new Date().toISOString(),
    relay_base: base,
    summary: {
      resolution: stream?.width && stream.height ? `${stream.width}x${stream.height}` : null,
      fps: stream?.fps ?? null,
      bitrate: stream?.bitrate ?? null,
      control_transport: control?.transport ?? null,
      control_mode: control?.mode ?? null,
    },
    checks,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
