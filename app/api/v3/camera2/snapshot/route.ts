import { type NextRequest } from 'next/server'
import { rejectUnauthorizedCameraRequest } from '@/lib/server/controlAuth'
import { proxyCam2RelayFrame } from '../proxyRelay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedCameraRequest(request)
  if (rejected) return rejected
  return proxyCam2RelayFrame('/snapshot', 'image/jpeg')
}
