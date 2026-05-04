import { NextResponse } from 'next/server'

/**
 * Server-side proxy for the live fragmented-MP4 video stream from the
 * field device. Used by the LiveCameraVideo component for sub-second
 * latency playback (vs. the older /api/v3/snapshot poll-and-swap).
 *
 * Why fragmented MP4: rkipc HW-encodes H.264 once, go2rtc rewraps the
 * RTSP packets into fmp4 with zero transcoding. Browsers play it
 * natively via the <video> element. CPU cost on the board is the
 * encoder it was already running anyway.
 *
 * Streaming, not buffering: we forward the upstream body directly
 * (`new NextResponse(upstream.body, …)`) so frames flow as they arrive.
 * Vercel Edge has a ~25-30 s response cap; the client component
 * detects stream-end and remounts a fresh <video> to reconnect.
 *
 * Codec: avc1.640028 (H.264 High @ L4.0). Universal browser support —
 * no HEVC compatibility table.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const STREAM = process.env.V3_FEED_STREAM || 'cayley-sub'

export async function GET() {
  try {
    // No client-side timeout: we let the connection live as long as
    // Vercel Edge will allow it (typically 25–30s on Pro), and the
    // client reconnects when it sees the stream end.
    const r = await fetch(
      `${UPSTREAM}/api/stream.mp4?src=${encodeURIComponent(STREAM)}`,
      {
        cache: 'no-store',
        headers: { 'User-Agent': 'andysottiaux.com/feed-proxy' },
      },
    )

    if (!r.ok || !r.body) {
      return new NextResponse(null, { status: 502 })
    }

    return new NextResponse(r.body, {
      status: 200,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'video/mp4',
        'Cache-Control': 'no-store',
        // Don't let intermediaries buffer
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
