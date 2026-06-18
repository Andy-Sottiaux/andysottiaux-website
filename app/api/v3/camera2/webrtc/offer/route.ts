const UPSTREAM =
  process.env.V3_CAMERA_HOST ||
  process.env.V3_CAMERA_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

const DEFAULT_STREAM = process.env.V3_CAMERA_2_STREAM || 'cam2'
const STREAM_RE = /^[A-Za-z0-9_.:-]+$/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const stream = url.searchParams.get('stream') || DEFAULT_STREAM
  if (!STREAM_RE.test(stream)) {
    return new Response('bad webrtc stream', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const offer = await request.text()
  if (!offer.includes('v=0') || !offer.includes('m=')) {
    return new Response('bad webrtc offer', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    const ctrl = new AbortController()
    timeoutId = setTimeout(() => ctrl.abort(), 8_000)
    const upstream = await fetch(`${UPSTREAM}/api/webrtc?src=${encodeURIComponent(stream)}`, {
      method: 'POST',
      body: offer,
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/sdp',
        'User-Agent': 'andysottiaux.com/camera2-webrtc-proxy',
      },
    })
    clearTimeout(timeoutId)
    timeoutId = null

    if (!upstream.ok) {
      return new Response(`webrtc upstream unavailable: ${upstream.status}`, {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const answer = await upstream.text()
    if (!answer.includes('v=0') || !answer.includes('m=')) {
      return new Response('webrtc upstream returned bad answer', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return new Response(answer, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': upstream.headers.get('content-type') || 'application/sdp',
      },
    })
  } catch {
    return new Response('webrtc upstream unreachable', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
