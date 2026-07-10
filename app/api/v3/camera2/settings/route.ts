import { NextRequest, NextResponse } from 'next/server'
import {
  rejectUnauthorizedControlRequest,
  relayControlAuthorizationHeader,
} from '@/lib/server/controlAuth'
import { requestThinginoPath } from '../proxyThingino'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const THREAD_RTSP = 1
const THREAD_VIDEO = 2
const RELAY_SETTINGS_URL =
  process.env.V3_CAMERA_2_SETTINGS_RELAY_URL ||
  'https://cayley-relay.tailc7d6b6.ts.net/api/camera2/settings'

type StreamSettings = {
  width?: number
  height?: number
  fps?: number
  bitrate?: number
  gop?: number
  max_gop?: number
  mode?: 'CBR' | 'VBR'
  format?: 'H264' | 'H265' | 'MJPEG' | string
  profile?: number
}

const CONFIG_REQUEST = {
  stream0: {
    enabled: null,
    width: null,
    height: null,
    fps: null,
    bitrate: null,
    gop: null,
    max_gop: null,
    format: null,
    mode: null,
    buffers: null,
    profile: null,
    rtsp_endpoint: null,
    audio_enabled: null,
  },
}

const PRESETS: Record<string, StreamSettings> = {
  hq30: {
    width: 2304,
    height: 1296,
    fps: 30,
    bitrate: 12000,
    gop: 30,
    max_gop: 60,
    format: 'H264',
    mode: 'CBR',
    profile: 0,
  },
  balanced24: {
    width: 2304,
    height: 1296,
    fps: 24,
    bitrate: 4000,
    gop: 24,
    max_gop: 48,
    format: 'H264',
    mode: 'CBR',
    profile: 0,
  },
}

function clampInt(value: unknown, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(min, Math.min(max, Math.round(parsed)))
}

function cleanStreamSettings(input: Record<string, unknown>): StreamSettings {
  const next: StreamSettings = {}
  const width = clampInt(input.width, 320, 4096)
  const height = clampInt(input.height, 240, 2160)
  const fps = clampInt(input.fps, 5, 30)
  const bitrate = clampInt(input.bitrate, 500, 12000)
  const gop = clampInt(input.gop, 1, 120)
  const maxGop = clampInt(input.max_gop, 1, 240)
  const profile = clampInt(input.profile, 0, 4)

  if (width != null) next.width = width
  if (height != null) next.height = height
  if (fps != null) next.fps = fps
  if (bitrate != null) next.bitrate = bitrate
  if (gop != null) next.gop = gop
  if (maxGop != null) next.max_gop = maxGop
  if (profile != null) next.profile = profile
  if (input.mode === 'CBR' || input.mode === 'VBR') next.mode = input.mode
  if (typeof input.format === 'string' && input.format.length <= 12) next.format = input.format

  return next
}

async function postPrudynt(payload: unknown, timeoutMs = 10000) {
  return requestThinginoPath('/x/json-prudynt.cgi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, timeoutMs)
}

async function readJson(response: Response) {
  return response.json().catch(() => null)
}

async function fetchRelaySettings(init?: RequestInit, timeoutMs = 8000) {
  const authorization = relayControlAuthorizationHeader()
  if (init?.method === 'POST' && !authorization) return null

  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(RELAY_SETTINGS_URL, {
      ...init,
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        'Content-Type': 'application/json',
        'User-Agent': 'andysottiaux.com/camera2-settings-proxy',
      },
    })
    const text = await res.text()
    if (res.ok || res.status < 500) {
      return new NextResponse(text, {
        status: res.status,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      })
    }
  } catch {
    // Fall back to the older Thingino proxy path.
  } finally {
    clearTimeout(timeoutId)
  }
  return null
}

async function readCurrentSettings() {
  const relay = await fetchRelaySettings()
  if (relay) return relay

  const [config, motor] = await Promise.all([
    postPrudynt(CONFIG_REQUEST, 10000),
    requestThinginoPath('/x/json-motor-params.cgi', {}, 5000),
  ])

  const configData = config.ok ? await readJson(config.response) : null
  const motorData = motor.ok && motor.response.ok ? await readJson(motor.response) : null

  return NextResponse.json({
    ok: config.ok && config.response.ok,
    stream0: configData?.stream0 ?? null,
    motor: motorData,
    errors: {
      config: config.ok ? (config.response.ok ? null : config.response.status) : config.error,
      motor: motor.ok ? (motor.response.ok ? null : motor.response.status) : motor.error,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  return readCurrentSettings()
}

export async function POST(request: NextRequest) {
  const rejected = rejectUnauthorizedControlRequest(request)
  if (rejected) return rejected

  const body = await request.json().catch(() => null) as {
    preset?: string
    stream0?: Record<string, unknown>
    persist?: boolean
  } | null

  const preset = body?.preset ? PRESETS[body.preset] : null
  const stream0 = preset || (body?.stream0 ? cleanStreamSettings(body.stream0) : null)
  if (!stream0 || Object.keys(stream0).length === 0) {
    return NextResponse.json({ ok: false, error: 'missing_stream_settings' }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const payload = {
    stream0,
    action: { restart_thread: THREAD_RTSP | THREAD_VIDEO },
  }

  const relay = await fetchRelaySettings({
    method: 'POST',
    body: JSON.stringify({
      stream0,
      persist: body?.persist,
    }),
  }, 14000)
  if (relay) return relay

  const apply = await postPrudynt(payload, 12000)
  if (!apply.ok) {
    return NextResponse.json({ ok: false, error: apply.error }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const applyData = await readJson(apply.response)
  let saveData: unknown = null
  if (body?.persist !== false && apply.response.ok) {
    const save = await postPrudynt({ action: { save_config: null } }, 10000)
    saveData = save.ok ? await readJson(save.response) : { error: save.error }
  }

  return NextResponse.json({
    ok: apply.response.ok,
    stream0: applyData?.stream0 ?? stream0,
    apply: applyData,
    save: saveData,
  }, {
    status: apply.response.ok ? 200 : 502,
    headers: { 'Cache-Control': 'no-store' },
  })
}
