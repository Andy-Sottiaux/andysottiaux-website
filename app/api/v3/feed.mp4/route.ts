/**
 * Server-side proxy for the live fragmented-MP4 video stream from the
 * field device. Used by FieldCameraFeed for sub-second latency playback.
 *
 * Why Node.js runtime (not Edge): we tested Edge first and it truncated
 * the response after ~1 KB (just the fmp4 moov box) instead of piping
 * the continuous binary stream. Node.js runtime forwards `r.body`
 * (a ReadableStream) cleanly and supports a longer `maxDuration` for
 * the long-lived response.
 *
 * Pipeline (zero transcoding anywhere):
 *   rkipc HW H.264 -> RTSP -> go2rtc rewrap to fmp4 -> us -> <video>
 *
 * The client component remounts the <video> element when this stream
 * ends (every ~maxDuration seconds), making the seam invisible.
 */

import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Pro lets us go up to 60s by default (configurable to 800s on
// higher plans). 50s leaves a safety margin under the platform cap and
// gives the client a clean reconnect cadence.
export const maxDuration = 50

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const STREAM = process.env.V3_FEED_STREAM || 'cayley-sub'

export async function GET(_req: NextRequest) {
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
