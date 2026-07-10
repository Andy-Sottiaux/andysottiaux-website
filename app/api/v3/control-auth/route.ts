import { NextRequest, NextResponse } from 'next/server'
import {
  clearControlSessionCookie,
  controlAuthConfigured,
  controlPasswordMatches,
  createControlSession,
  hasValidControlSession,
  requestHasSameOrigin,
  setControlSessionCookie,
} from '@/lib/server/controlAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 6
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

type AttemptBucket = { count: number; resetAt: number }

const globalAttempts = globalThis as typeof globalThis & {
  controlAuthAttempts?: Map<string, AttemptBucket>
}
const attempts = globalAttempts.controlAuthAttempts ?? new Map<string, AttemptBucket>()
globalAttempts.controlAuthAttempts = attempts

function clientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function consumeAttempt(request: NextRequest) {
  const key = clientKey(request)
  const now = Date.now()
  const current = attempts.get(key)
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + ATTEMPT_WINDOW_MS }
    : current
  bucket.count += 1
  attempts.set(key, bucket)
  return bucket.count <= MAX_ATTEMPTS
}

function clearAttempts(request: NextRequest) {
  attempts.delete(clientKey(request))
}

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(request: NextRequest) {
  return json({
    ok: true,
    configured: controlAuthConfigured(),
    authenticated: hasValidControlSession(request),
  })
}

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return json({ ok: false, error: 'invalid_origin' }, 403)
  if (!controlAuthConfigured()) return json({ ok: false, error: 'control_auth_unconfigured' }, 503)
  if (!consumeAttempt(request)) return json({ ok: false, error: 'too_many_attempts' }, 429)

  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > 1024) return json({ ok: false, error: 'request_too_large' }, 413)

  const body = await request.json().catch(() => null) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!controlPasswordMatches(password)) return json({ ok: false, error: 'invalid_credentials' }, 401)

  const session = createControlSession()
  if (!session) return json({ ok: false, error: 'control_auth_unconfigured' }, 503)

  clearAttempts(request)
  const response = json({ ok: true, authenticated: true })
  setControlSessionCookie(response, session)
  return response
}

export async function DELETE(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return json({ ok: false, error: 'invalid_origin' }, 403)
  const response = json({ ok: true, authenticated: false })
  clearControlSessionCookie(response)
  return response
}
