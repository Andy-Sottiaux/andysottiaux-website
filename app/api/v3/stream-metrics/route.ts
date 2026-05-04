import { NextResponse } from 'next/server'

/**
 * Server-side proxy for browser-reported WebRTC stream telemetry.
 *
 * Browsers POST { session_id, protocol, rtt_ms, jitter_ms, packet_loss,
 * kbps, fps } here every 5 s while a stream is live. We forward to the
 * board's /api/stream/client-metrics, which aggregates them into the
 * /api/services view and the /api/stream/stats dashboard.
 *
 * Lossy on purpose: we never block the client on this. Quick timeout,
 * swallow errors, return 204 on success or unreachable.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'

export async function POST(req: Request) {
  try {
    const body = await req.text()
    if (body.length > 4096) {
      return new NextResponse(null, { status: 413 })
    }
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 1500)
    await fetch(`${UPSTREAM}/api/stream/client-metrics`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers.get('user-agent') ?? 'andysottiaux.com/metrics-proxy',
      },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)
    return new NextResponse(null, { status: 204 })
  } catch {
    // Telemetry failures are not user-visible. Return 204 either way.
    return new NextResponse(null, { status: 204 })
  }
}
