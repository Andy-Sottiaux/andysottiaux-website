const UPSTREAM =
  process.env.V3_CAMERA_2_UPSTREAM_HOST ||
  'http://192.168.4.45'

const USERNAME = process.env.V3_CAMERA_2_USERNAME || 'root'
const PASSWORD = process.env.V3_CAMERA_2_PASSWORD || 'root'

function encodeBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64')
}

async function thinginoSessionCookie(signal: AbortSignal) {
  const login = await fetch(`${UPSTREAM}/x/login.cgi`, {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'andysottiaux.com/camera2-proxy',
    },
    body: JSON.stringify({
      username: USERNAME,
      password: encodeBase64(PASSWORD),
      encoding: 'base64',
    }),
  })

  if (!login.ok) return null

  const cookie = login.headers.get('set-cookie')
  return cookie?.split(';')[0] || null
}

export async function proxyThinginoFrame(path: string, contentType: string, timeoutMs = 8000) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    const ctrl = new AbortController()
    timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
    const cookie = await thinginoSessionCookie(ctrl.signal)

    if (!cookie) {
      clearTimeout(timeoutId)
      timeoutId = null
      return new Response('thingino auth unavailable', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const upstream = await fetch(`${UPSTREAM}${path}`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        Cookie: cookie,
        'User-Agent': 'andysottiaux.com/camera2-proxy',
      },
    })
    clearTimeout(timeoutId)
    timeoutId = null

    if (!upstream.ok || !upstream.body) {
      return new Response('thingino upstream unavailable', {
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
    return new Response('thingino upstream unreachable', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
