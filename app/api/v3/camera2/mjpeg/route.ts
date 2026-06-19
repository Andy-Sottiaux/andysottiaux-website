import { fallbackMediaResponse } from '../../camera/fallbackMedia'
import { proxyThinginoFrame } from '../proxyThingino'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const blocked = fallbackMediaResponse('camera2 mjpeg fallback')
  if (blocked) return blocked

  return proxyThinginoFrame('/x/ch0.mjpg', 'multipart/x-mixed-replace', 8000)
}
