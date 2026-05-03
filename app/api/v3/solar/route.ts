import { NextResponse } from 'next/server'

/**
 * Server-side proxy for the field device's /api/solar endpoint.
 *
 * Hides the upstream hostname so the client bundle and DevTools Network
 * tab never see anything but `/api/v3/solar` on this origin.
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
    if (!r.ok) {
      return NextResponse.json(
        { error: 'upstream', upstream_status: r.status },
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
      { error: 'unreachable' },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
