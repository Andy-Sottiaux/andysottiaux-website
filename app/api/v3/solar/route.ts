import { NextResponse } from 'next/server'
import { publicSolar } from '@/lib/publicTelemetry'
import { readFieldTelemetry } from '@/lib/server/fieldTelemetry'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await readFieldTelemetry('solar', '/api/solar')
  const headers = { 'Cache-Control': 'no-store' }
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers })
  const body = publicSolar(result.body)
  return NextResponse.json(body, { status: body.live ? 200 : 503, headers })
}
