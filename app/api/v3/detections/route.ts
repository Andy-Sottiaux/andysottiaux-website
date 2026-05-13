import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_DETECTIONS_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const windowSec = url.searchParams.get('window_sec') || '300'

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(`${UPSTREAM}/api/detections?window_sec=${encodeURIComponent(windowSec)}`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/detections-proxy' },
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
      { ok: false, error: 'detections_unreachable', counts: {}, recent: [] },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
