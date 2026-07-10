import { NextRequest, NextResponse } from 'next/server'
import {
  createRelayControlTicket,
  rejectUnauthorizedControlRequest,
} from '@/lib/server/controlAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rejected = rejectUnauthorizedControlRequest(request)
  if (rejected) return rejected

  const ticket = createRelayControlTicket()
  if (!ticket) {
    return NextResponse.json({ ok: false, error: 'relay_control_auth_unconfigured' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json({ ok: true, ...ticket }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
