import { NextRequest, NextResponse } from 'next/server'
import { requestThinginoPath } from '../proxyThingino'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MotorParams = {
  steps_pan?: number
  steps_tilt?: number
  pos_0_x?: number | string
  pos_0_y?: number | string
}

const DIRECTIONS = new Set(['uc', 'ur', 'cr', 'dr', 'dc', 'dl', 'cl', 'ul'])
const MOTOR_PARAMS_TTL_MS = 60 * 1000
const RELAY_CONTROL_URL =
  process.env.V3_CAMERA_2_CONTROL_RELAY_URL ||
  'https://cayley-relay.tailc7d6b6.ts.net/api/camera2/control'

let cachedMotorParams: { params: MotorParams; expiresAt: number } | null = null

function numeric(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function readMotorParams(): Promise<MotorParams> {
  if (cachedMotorParams && cachedMotorParams.expiresAt > Date.now()) {
    return cachedMotorParams.params
  }

  const res = await requestThinginoPath('/x/json-motor-params.cgi', {}, 5000)
  if (!res.ok || !res.response.ok) return cachedMotorParams?.params ?? {}
  const params = await res.response.json().catch(() => ({}))
  cachedMotorParams = { params, expiresAt: Date.now() + MOTOR_PARAMS_TTL_MS }
  return params
}

async function runMotorQuery(query: URLSearchParams) {
  const res = await requestThinginoPath(`/x/json-motor.cgi?${query.toString()}`, {}, 6000)
  if (!res.ok) return jsonError(res.error, 502)
  const data = await res.response.json().catch(() => null)
  if (!res.response.ok) {
    return NextResponse.json({ ok: false, error: 'motor_command_failed', upstream_status: res.response.status, data }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
}

async function runRelayControl(body: unknown) {
  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(RELAY_CONTROL_URL, {
      method: 'POST',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'andysottiaux.com/camera2-control-proxy',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    const contentType = res.headers.get('content-type') || 'application/json; charset=utf-8'
    if (res.ok || res.status < 500) {
      return new NextResponse(text, {
        status: res.status,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': contentType,
        },
      })
    }
  } catch {
    // Fall through to the slower Thingino proxy path when the relay endpoint is unavailable.
  } finally {
    clearTimeout(timeoutId)
  }
  return null
}

function relativeMove(direction: string, params: MotorParams, granularity: number) {
  const panMax = Math.max(1, numeric(params.steps_pan, 1000))
  const tiltMax = Math.max(1, numeric(params.steps_tilt, 1000))
  const xStep = panMax / granularity
  const yStep = tiltMax / granularity
  const x = direction.includes('l') ? -xStep : direction.includes('r') ? xStep : 0
  const y = direction.includes('d') ? -yStep : direction.includes('u') ? yStep : 0
  return { x, y }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    direction?: string
    command?: string
    step?: 'fine' | 'normal' | 'coarse'
    hold?: boolean
  } | null
  const command = body?.command || body?.direction

  if (!command) return jsonError('missing_command')

  const relayResponse = await runRelayControl({
    command,
    step: body?.step || 'normal',
    hold: body?.hold === true,
  })
  if (relayResponse) return relayResponse

  if (command === 'stop') {
    return runMotorQuery(new URLSearchParams({ d: 's' }))
  }

  if (DIRECTIONS.has(command)) {
    const params = await readMotorParams()
    const granularity = body?.step === 'fine' ? 100 : body?.step === 'coarse' ? 25 : 60
    const move = relativeMove(command, params, granularity)
    const query = new URLSearchParams({
      d: 'g',
      x: move.x.toFixed(3),
      y: move.y.toFixed(3),
    })
    return runMotorQuery(query)
  }

  if (command === 'center') {
    return runHomeCommand()
  }

  if (command === 'home') {
    return runHomeCommand()
  }

  return jsonError('unknown_command')
}

async function runHomeCommand() {
  const reset = await requestThinginoPath('/x/json-motor.cgi?d=b', {}, 6000)
  if (!reset.ok) {
    if (reset.error === 'login_timeout') {
      return NextResponse.json({
        ok: true,
        data: { result: 'started', note: 'Thingino home command did not return before the HTTP timeout.' },
      }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return jsonError(reset.error, 502)
  }

  const data = await reset.response.json().catch(() => null)
  return NextResponse.json({ ok: reset.response.ok, data }, {
    status: reset.response.ok ? 200 : 502,
    headers: { 'Cache-Control': 'no-store' },
  })
}
