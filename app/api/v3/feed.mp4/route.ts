/**
 * Server-side proxy for the live fragmented-MP4 video stream from the
 * field device. Used by FieldCameraFeed for sub-second latency playback.
 *
 * Pipeline (zero transcoding anywhere):
 *   rkipc HW H.264 -> RTSP -> go2rtc rewrap to fmp4 -> us -> <video>
 *
 * Runtime choice: Edge. Vercel Hobby caps Node.js serverless functions
 * at 10 s — too short for a continuous stream. Edge runtime allows
 * streamed responses up to ~25 s on Hobby (longer on Pro). The client
 * remounts the <video> element when the stream ends, so the cap is a
 * UX seam (~100 ms gap), not a feature limit.
 *
 * Streaming, not buffering: we forward the upstream body directly
 * (`new Response(upstream.body, …)`) so binary fmp4 frames flow as
 * they arrive. No `arrayBuffer()` consumption.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const STREAM = process.env.V3_FEED_STREAM || 'cayley-sub'

export async function GET() {
  try {
    const r = await fetch(
      `${UPSTREAM}/api/stream.mp4?src=${encodeURIComponent(STREAM)}`,
      {
        cache: 'no-store',
        headers: { 'User-Agent': 'andysottiaux.com/feed-proxy' },
      },
    )

    if (!r.ok || !r.body) {
      return new Response(null, { status: 502 })
    }

    return new Response(r.body, {
      status: 200,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'video/mp4',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
