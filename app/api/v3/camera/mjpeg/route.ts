import { type NextRequest } from 'next/server'
import { rejectUnauthorizedCameraRequest } from '@/lib/server/controlAuth'
import { fallbackMediaResponse } from '../fallbackMedia'
import { proxyCameraFrame } from '../proxyCamera'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedCameraRequest(request)
  if (rejected) return rejected
  const blocked = fallbackMediaResponse('camera mjpeg fallback')
  if (blocked) return blocked

  return proxyCameraFrame('/api/camera/mjpeg', 'multipart/x-mixed-replace', 8000)
}
