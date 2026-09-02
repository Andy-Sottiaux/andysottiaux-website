import { type NextRequest, NextResponse } from 'next/server'
import {
  rejectUnauthorizedCameraRequest,
  relayControlAuthorizationHeader,
} from '@/lib/server/controlAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_TRAINING_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedCameraRequest(request)
  if (rejected) return rejected

  const authorization = relayControlAuthorizationHeader()
  if (!authorization) {
    return NextResponse.json({ ok: false, error: 'camera_relay_auth_unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(`${UPSTREAM}/api/training/status`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        Authorization: authorization,
        'User-Agent': 'andysottiaux.com/training-status-proxy',
      },
    })
    clearTimeout(timeoutId)

    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: 'training_upstream_status', upstream_status: r.status },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    }

    const body = await r.json()
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'training_unreachable' },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
