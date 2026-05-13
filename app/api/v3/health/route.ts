import { NextResponse } from 'next/server'

/**
 * Server-side proxy for the field relay's /api/health endpoint.
 *
 * Keeps the upstream hostname out of the client bundle and DevTools
 * Network tab. The browser only ever sees `/api/v3/health` on this
 * origin; the upstream identifier never leaves the server.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_HEALTH_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export async function GET() {
  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(`${UPSTREAM}/api/health`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/health-proxy' },
    })
    clearTimeout(timeoutId)
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, upstream_status: r.status },
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
      { ok: false, error: 'unreachable' },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
