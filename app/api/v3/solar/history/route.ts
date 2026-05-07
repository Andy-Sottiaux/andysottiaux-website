import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_SOLAR_HISTORY_UPSTREAM_HOST ||
  process.env.V3_SOLAR_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export async function GET() {
  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(`${UPSTREAM}/api/solar/history?hours=24`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/solar-history-proxy' },
    })
    clearTimeout(timeoutId)

    const body = await r.text()
    const upstreamCt = r.headers.get('content-type') || 'application/json'
    return new NextResponse(body, {
      status: r.status,
      headers: {
        'Content-Type': upstreamCt,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'history_unavailable' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
