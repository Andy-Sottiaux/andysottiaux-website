import { NextResponse } from 'next/server'

/**
 * Server-side proxy for the field device's /api/solar endpoint.
 *
 * Hides the upstream hostname so the client bundle and DevTools Network
 * tab never see anything but `/api/v3/solar` on this origin.
 *
 * Behaviour: the upstream returns useful information even on non-2xx
 * (e.g. 503 + `{"error":"no telemetry yet"}` while the BMV is out of BLE
 * range). We pass that body and status through verbatim so the client
 * can distinguish "sensor inactive" (upstream said so) from "proxy/network
 * unreachable" (we never got a response). Masking 5xx with our own JSON
 * makes the card render "broken" when in fact things are working.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'

export async function GET() {
  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(`${UPSTREAM}/api/solar`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/solar-proxy' },
    })
    clearTimeout(timeoutId)

    // Pass the upstream body + status through. The upstream may not always
    // be JSON (especially on 5xx), but we forward whatever it sent and let
    // the client try to parse — it falls back to a string check.
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
      { error: 'unreachable' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
