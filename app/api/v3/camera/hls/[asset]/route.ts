import { fallbackMediaResponse } from '../../fallbackMedia'

const UPSTREAM =
  process.env.V3_CAMERA_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function contentType(asset: string) {
  if (asset.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (asset.endsWith('.ts')) return 'video/mp2t'
  return 'application/octet-stream'
}

function cacheHeaders(asset: string) {
  if (asset.endsWith('.m3u8')) {
    return {
      'Cache-Control': 'no-store',
      'CDN-Cache-Control': 'max-age=0',
      'Vercel-CDN-Cache-Control': 'max-age=0',
    }
  }
  return {
    'Cache-Control': 'no-store',
    'CDN-Cache-Control': 'max-age=0',
    'Vercel-CDN-Cache-Control': 'max-age=0',
  }
}

export async function GET(_request: Request, { params }: { params: { asset: string } }) {
  const blocked = fallbackMediaResponse('camera hls fallback')
  if (blocked) return blocked

  const asset = params.asset
  if (!asset || asset !== asset.split('/').at(-1) || (!asset.endsWith('.m3u8') && !asset.endsWith('.ts'))) {
    return new Response('bad hls asset', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const upstreamUrl = `${UPSTREAM}/api/camera/hls/${encodeURIComponent(asset)}`
  const attempts = asset.endsWith('.ts') ? 3 : 2

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const ctrl = new AbortController()
      timeoutId = setTimeout(() => ctrl.abort(), asset.endsWith('.ts') ? 10_000 : 5_000)
      const upstream = await fetch(upstreamUrl, {
        cache: 'no-store',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'andysottiaux.com/camera-hls-proxy' },
      })
      clearTimeout(timeoutId)
      timeoutId = null

      if (!upstream.ok || !upstream.body) {
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 120 * attempt))
          continue
        }
        return new Response(`hls upstream unavailable: ${upstream.status}`, {
          status: 502,
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...cacheHeaders(asset),
          'Content-Type': upstream.headers.get('content-type') || contentType(asset),
        },
      })
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 120 * attempt))
        continue
      }
      return new Response('hls upstream unavailable', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
  }

  return new Response('hls upstream unreachable', {
    status: 502,
    headers: { 'Cache-Control': 'no-store' },
  })
}
