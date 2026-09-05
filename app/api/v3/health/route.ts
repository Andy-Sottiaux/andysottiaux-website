import { NextResponse } from 'next/server'
import { publicHealth } from '@/lib/publicTelemetry'
import { readFieldTelemetry } from '@/lib/server/fieldTelemetry'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await readFieldTelemetry('health', '/api/health')
  const headers = { 'Cache-Control': 'no-store' }
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers })
  const body = publicHealth(result.body)
  if (!body) return NextResponse.json({ ok: false, error: 'upstream_invalid_schema' }, { status: 502, headers })
  return NextResponse.json(body, { status: !body.ok || body.telemetry.stale ? 503 : 200, headers })
}
