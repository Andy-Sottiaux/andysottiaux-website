import { proxyThinginoFrame } from '../proxyThingino'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return proxyThinginoFrame('/x/ch0.jpg', 'image/jpeg')
}
