import { NextRequest, NextResponse } from 'next/server'
import {
  rejectUnauthorizedCameraRequest,
  rejectUnauthorizedControlRequest,
} from '@/lib/server/controlAuth'
import { requestCam2Relay } from '../proxyRelay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function proxySettings(init?: RequestInit, timeoutMs = 10_000) {
  const upstream = await requestCam2Relay('/settings', init, timeoutMs)
  if (!upstream) {
    return NextResponse.json({ ok: false, error: 'camera_relay_unavailable' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    },
  })
}

export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedCameraRequest(request)
  if (rejected) return rejected
  return proxySettings()
}

export async function POST(request: NextRequest) {
  const rejected = rejectUnauthorizedControlRequest(request)
  if (rejected) return rejected

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return proxySettings({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 14_000)
}
