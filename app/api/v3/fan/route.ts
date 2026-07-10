import { NextRequest, NextResponse } from 'next/server'
import {
  rejectUnauthorizedControlRequest,
  relayControlAuthorizationHeader,
} from '@/lib/server/controlAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_FAN_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

const DEFAULT_TTL_SEC = 90
const MAX_TTL_SEC = 300

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export async function GET() {
  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(`${UPSTREAM}/api/fan`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/fan-proxy' },
    })
    clearTimeout(timeoutId)
    const body = await r.text()
    return new NextResponse(body, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'fan_unreachable' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}

export async function POST(request: NextRequest) {
  const rejected = rejectUnauthorizedControlRequest(request)
  if (rejected) return rejected

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const body = raw as Record<string, unknown>
  let payload: Record<string, unknown>

  if (body?.auto === true || body?.mode === 'auto') {
    payload = { mode: 'auto' }
  } else {
    const speed = finiteNumber(body?.speed)
    if (speed == null || speed < 0 || speed > 100) {
      return NextResponse.json({ ok: false, error: 'speed_out_of_range' }, { status: 400 })
    }
    const ttlRaw = finiteNumber(body?.ttl_sec) ?? finiteNumber(body?.ttl_s) ?? DEFAULT_TTL_SEC
    payload = {
      speed: clampInt(speed, 0, 100),
      ttl_sec: clampInt(ttlRaw, 1, MAX_TTL_SEC),
    }
  }

  const authorization = relayControlAuthorizationHeader()
  if (!authorization) {
    return NextResponse.json({ ok: false, error: 'relay_control_auth_unconfigured' }, { status: 503 })
  }

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 15000)
    const r = await fetch(`${UPSTREAM}/api/fan`, {
      method: 'POST',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        'User-Agent': 'andysottiaux.com/fan-proxy',
      },
      body: JSON.stringify(payload),
    })
    clearTimeout(timeoutId)
    const responseBody = await r.text()
    return new NextResponse(responseBody, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'fan_unreachable' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
