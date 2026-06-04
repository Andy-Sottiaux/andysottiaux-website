import { proxyCameraFrame } from '../proxyCamera'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  return proxyCameraFrame('/api/camera/snapshot.jpeg', 'image/jpeg')
}
