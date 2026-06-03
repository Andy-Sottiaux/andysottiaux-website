import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_CAMERA_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export async function GET() {
  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(`${UPSTREAM}/api/camera/quality`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/camera-quality-proxy' },
    })
    clearTimeout(timeoutId)

    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: 'quality_upstream_status', upstream_status: r.status },
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
      { ok: false, error: 'quality_unreachable' },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
