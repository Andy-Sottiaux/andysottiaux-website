import { NextResponse } from 'next/server'

/**
 * Server-side proxy for the field solar /api/solar endpoint.
 *
 * Hides the upstream hostname so the client bundle and DevTools Network
 * tab never see anything but `/api/v3/solar` on this origin.
 *
 * The Raspberry Pi reads the Victron BLE data privately, cayley-relay
 * normalizes it, and this route keeps the public site pinned to a same-origin
 * API. Non-2xx upstream bodies are passed through so the client can
 * distinguish "sensor inactive" from "proxy/network unreachable".
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_SOLAR_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

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
