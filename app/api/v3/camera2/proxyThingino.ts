const UPSTREAM =
  process.env.V3_CAMERA_2_UPSTREAM_HOST ||
  'http://192.168.4.45'

const USERNAME = process.env.V3_CAMERA_2_USERNAME || 'root'
const PASSWORD = process.env.V3_CAMERA_2_PASSWORD || 'root'
const SESSION_TTL_MS = 5 * 60 * 1000

let cachedSession: { cookie: string; expiresAt: number } | null = null

type ThinginoError = 'auth_unavailable' | 'camera_unreachable' | 'login_status' | 'login_timeout'

type ThinginoLoginResult =
  | { ok: true; cookie: string }
  | { ok: false; error: ThinginoError; upstreamStatus?: number }

type ThinginoRequestResult =
  | { ok: true; response: Response }
  | { ok: false; error: ThinginoError; upstreamStatus?: number }

function encodeBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64')
}

async function thinginoSessionCookie(signal: AbortSignal, forceRefresh = false): Promise<ThinginoLoginResult> {
  if (!forceRefresh && cachedSession && cachedSession.expiresAt > Date.now()) {
    return { ok: true, cookie: cachedSession.cookie }
  }

  try {
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

    if (!login.ok) {
      const body = await login.text().catch(() => '')
      return {
        ok: false,
        error: login.status === 502 && body.includes('relay upstream error')
          ? 'camera_unreachable'
          : 'login_status',
        upstreamStatus: login.status,
      }
    }

    const cookie = login.headers.get('set-cookie')?.split(';')[0] || null
    if (cookie) {
      cachedSession = { cookie, expiresAt: Date.now() + SESSION_TTL_MS }
      return { ok: true, cookie }
    }

    return { ok: false, error: 'auth_unavailable' }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof DOMException && error.name === 'AbortError'
        ? 'login_timeout'
        : 'camera_unreachable',
    }
  }
}

export async function requestThinginoPath(
  path: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<ThinginoRequestResult> {
  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const login = await thinginoSessionCookie(ctrl.signal)
    if (!login.ok) return login

    const headers = new Headers(init.headers)
    headers.set('Cookie', login.cookie)
    headers.set('User-Agent', 'andysottiaux.com/camera2-proxy')

    let response = await fetch(`${UPSTREAM}${path}`, {
      ...init,
      cache: 'no-store',
      signal: ctrl.signal,
      headers,
    })

    if (response.status === 401 || response.status === 403) {
      cachedSession = null
      const freshLogin = await thinginoSessionCookie(ctrl.signal, true)
      if (!freshLogin.ok) return freshLogin
      headers.set('Cookie', freshLogin.cookie)
      response = await fetch(`${UPSTREAM}${path}`, {
        ...init,
        cache: 'no-store',
        signal: ctrl.signal,
        headers,
      })
    }

    return { ok: true, response }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof DOMException && error.name === 'AbortError'
        ? 'login_timeout'
        : 'camera_unreachable',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function probeThinginoStatus(timeoutMs = 5000) {
  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const login = await thinginoSessionCookie(ctrl.signal)
    return login.ok
      ? { ok: true as const, state: 'ready' as const }
      : {
          ok: false as const,
          state: 'offline' as const,
          error: login.error,
          upstream_status: login.upstreamStatus,
        }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function proxyThinginoFrame(path: string, contentType: string, timeoutMs = 8000) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    const ctrl = new AbortController()
    timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
    const login = await thinginoSessionCookie(ctrl.signal)

    if (!login.ok) {
      clearTimeout(timeoutId)
      timeoutId = null
      const body = login.error === 'camera_unreachable' || login.error === 'login_timeout'
        ? 'thingino camera unreachable'
        : 'thingino auth unavailable'
      return new Response(body, {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'X-Cam2-Error': login.error,
        },
      })
    }

    const upstream = await fetch(`${UPSTREAM}${path}`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        Cookie: login.cookie,
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
