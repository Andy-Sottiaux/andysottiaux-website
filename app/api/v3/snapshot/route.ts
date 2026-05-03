import { NextResponse } from 'next/server'

/**
 * Server-side proxy for a single JPEG snapshot from the field device.
 *
 * The browser polls this every couple of seconds with a cache-buster
 * query string and renders the response as an `<img>` src — a 0.5-fps
 * "live" feed that's reliable through Edge runtime (no WebRTC signaling
 * complexity, no header-stripping concerns, just an HTTP response of
 * type image/jpeg).
 *
 * The upstream path matches go2rtc's MJPEG snapshot: `/api/frame.jpeg`.
 * If go2rtc isn't currently exposed via the funnel the proxy returns
 * 502 and the camera card falls back to its polished offline state.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const STREAM = process.env.V3_FEED_STREAM || 'cayley'

export async function GET() {
  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 6000)
    const r = await fetch(
      `${UPSTREAM}/api/frame.jpeg?src=${encodeURIComponent(STREAM)}`,
      {
        cache: 'no-store',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'andysottiaux.com/snapshot-proxy' },
      },
    )
    clearTimeout(timeoutId)

    if (!r.ok) {
      return new NextResponse(null, { status: 502 })
    }

    const buf = await r.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
