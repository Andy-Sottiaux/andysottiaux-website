import { type NextRequest, NextResponse } from 'next/server'
import { rejectUnauthorizedCameraRequest } from '@/lib/server/controlAuth'
import { requestCam2Relay } from '../proxyRelay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedCameraRequest(request)
  if (rejected) return rejected
  const upstream = await requestCam2Relay('/status', {}, 5000)
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
