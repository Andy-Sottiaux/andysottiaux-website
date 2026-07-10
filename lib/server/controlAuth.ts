import 'server-only'

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

export const CONTROL_SESSION_COOKIE = 'cayley_control_session'

const SESSION_VERSION = 'v1'
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
const CONTROL_TICKET_TTL_SECONDS = 90

type ControlAuthConfig = {
  passwordHash: string
  signingSecret: string
}

function controlAuthConfig(): ControlAuthConfig | null {
  const passwordHash = process.env.CONTROL_AUTH_PASSWORD_HASH?.trim().toLowerCase() ?? ''
  const signingSecret = process.env.CONTROL_AUTH_SECRET?.trim() ?? ''
  if (!/^[a-f0-9]{64}$/.test(passwordHash) || signingSecret.length < 32) return null
  return { passwordHash, signingSecret }
}

function equalText(left: string, right: string) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

function passwordHash(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64url')
}

export function controlAuthConfigured() {
  return controlAuthConfig() !== null
}

export function controlPasswordMatches(value: string) {
  const config = controlAuthConfig()
  if (!config || value.length > 512) return false
  return equalText(passwordHash(value), config.passwordHash)
}

export function createControlSession() {
  const config = controlAuthConfig()
  if (!config) return null
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = `${SESSION_VERSION}.${expiresAt}.${randomBytes(18).toString('base64url')}`
  return `${payload}.${signature(payload, config.signingSecret)}`
}

export function hasValidControlSession(request: NextRequest) {
  const config = controlAuthConfig()
  const value = request.cookies.get(CONTROL_SESSION_COOKIE)?.value ?? ''
  if (!config || !value) return false

  const parts = value.split('.')
  if (parts.length !== 4 || parts[0] !== SESSION_VERSION) return false
  const expiresAt = Number(parts[1])
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false

  const payload = parts.slice(0, 3).join('.')
  return equalText(parts[3], signature(payload, config.signingSecret))
}

export function requestHasSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const parsed = new URL(origin)
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const expectedHost = forwardedHost || request.headers.get('host') || request.nextUrl.host
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const expectedProtocol = forwardedProto ? `${forwardedProto}:` : new URL(request.url).protocol
    return parsed.host === expectedHost && parsed.protocol === expectedProtocol
  } catch {
    return false
  }
}

export function rejectUnauthorizedControlRequest(request: NextRequest) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'invalid_origin' }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  if (!controlAuthConfigured()) {
    return NextResponse.json({ ok: false, error: 'control_auth_unconfigured' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  if (!hasValidControlSession(request)) {
    return NextResponse.json({ ok: false, error: 'control_auth_required' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return null
}

export function setControlSessionCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: CONTROL_SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearControlSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: CONTROL_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export function relayControlAuthorizationHeader() {
  const token = process.env.V3_DEVICE_CONTROL_RELAY_TOKEN?.trim()
  return token ? `Bearer ${token}` : null
}

export function createRelayControlTicket() {
  const token = process.env.V3_DEVICE_CONTROL_RELAY_TOKEN?.trim()
  if (!token) return null
  const expiresAt = Math.floor(Date.now() / 1000) + CONTROL_TICKET_TTL_SECONDS
  const payload = `ws1.${expiresAt}.${randomBytes(18).toString('base64url')}`
  const ticketSignature = createHmac('sha256', token)
    .update(`cam2-control-ws:${payload}`, 'utf8')
    .digest('base64url')
  return { ticket: `${payload}.${ticketSignature}`, expiresAt }
}
