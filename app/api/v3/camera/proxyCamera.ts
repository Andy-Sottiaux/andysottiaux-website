const UPSTREAM =
  process.env.V3_CAMERA_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export async function proxyCameraFrame(path: string, contentType: string, timeoutMs = 5000) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    const ctrl = new AbortController()
    timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
    const upstream = await fetch(`${UPSTREAM}${path}`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/camera-frame-proxy' },
    })
    clearTimeout(timeoutId)
    timeoutId = null

    if (!upstream.ok || !upstream.body) {
      return new Response('camera upstream unavailable', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': upstream.headers.get('content-type') || contentType,
      },
    })
  } catch {
    return new Response('camera upstream unreachable', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
