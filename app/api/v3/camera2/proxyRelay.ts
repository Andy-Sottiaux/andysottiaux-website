import { relayControlAuthorizationHeader } from '@/lib/server/controlAuth'

const RELAY_BASE = (
  process.env.V3_CAMERA_2_PUBLIC_RELAY_BASE ||
  'https://cam2.andysottiaux.com/api/camera2'
).replace(/\/+$/, '')

export async function requestCam2Relay(
  path: string,
  init: RequestInit = {},
  timeoutMs = 8000,
) {
  const authorization = relayControlAuthorizationHeader()
  if (!authorization || !path.startsWith('/')) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers(init.headers)
    headers.set('Authorization', authorization)
    headers.set('User-Agent', 'andysottiaux.com/camera2-relay-proxy')
    return await fetch(`${RELAY_BASE}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers,
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function proxyCam2RelayFrame(path: string, contentType: string, timeoutMs = 8000) {
  const upstream = await requestCam2Relay(path, {}, timeoutMs)
  if (!upstream?.ok || !upstream.body) {
    return new Response('camera 2 relay unavailable', {
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
}
