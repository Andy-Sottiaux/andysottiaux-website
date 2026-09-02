import { type NextRequest } from 'next/server'
import { rejectUnauthorizedCameraRequest } from '@/lib/server/controlAuth'
import { proxyCameraFrame } from '../proxyCamera'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedCameraRequest(request)
  if (rejected) return rejected
  return proxyCameraFrame('/api/camera/sanitized.jpeg', 'image/jpeg')
}
