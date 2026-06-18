import { NextResponse } from 'next/server'
import { probeThinginoStatus } from '../proxyThingino'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await probeThinginoStatus()
  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
