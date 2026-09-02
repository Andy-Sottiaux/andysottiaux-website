import { type NextRequest } from 'next/server'
import { rejectUnauthorizedCameraRequest } from '@/lib/server/controlAuth'
import { fallbackMediaResponse } from '../../camera/fallbackMedia'
import { proxyCam2RelayFrame } from '../proxyRelay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedCameraRequest(request)
  if (rejected) return rejected
  const blocked = fallbackMediaResponse('camera2 mjpeg fallback')
  if (blocked) return blocked

  return proxyCam2RelayFrame('/mjpeg', 'multipart/x-mixed-replace', 8000)
}
