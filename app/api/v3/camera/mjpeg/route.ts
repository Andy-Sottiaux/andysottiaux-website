import { fallbackMediaResponse } from '../fallbackMedia'
import { proxyCameraFrame } from '../proxyCamera'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const blocked = fallbackMediaResponse('camera mjpeg fallback')
  if (blocked) return blocked

  return proxyCameraFrame('/api/camera/mjpeg', 'multipart/x-mixed-replace', 8000)
}
