import { NextResponse } from 'next/server'

/**
 * Server-side WHEP proxy for the field device's WebRTC endpoint.
 *
 * The browser POSTs an SDP offer (Content-Type: application/sdp) to
 * `/api/v3/feed`; this route forwards it to the upstream go2rtc
 * `/api/webrtc?src=…` endpoint and returns the SDP answer. The upstream
 * hostname and stream name never appear in the client bundle.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const STREAM = process.env.V3_FEED_STREAM || 'cayley'

export async function POST(req: Request) {
  try {
    const offerSdp = await req.text()
    if (!offerSdp || !offerSdp.startsWith('v=')) {
      return new NextResponse('bad offer', { status: 400 })
    }

    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(
      `${UPSTREAM}/api/webrtc?src=${encodeURIComponent(STREAM)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          'User-Agent': 'andysottiaux.com/feed-proxy',
        },
        body: offerSdp,
        signal: ctrl.signal,
        cache: 'no-store',
      },
    )
    clearTimeout(timeoutId)

    if (!r.ok) {
      return new NextResponse('upstream ' + r.status, { status: 502 })
    }

    const answerSdp = await r.text()
    return new NextResponse(answerSdp, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse('unreachable', { status: 502 })
  }
}
