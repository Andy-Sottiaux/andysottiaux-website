const UPSTREAM =
  process.env.V3_CAMERA_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export const runtime = 'edge'
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
  const asset = params.asset
  if (!asset || asset !== asset.split('/').at(-1) || (!asset.endsWith('.m3u8') && !asset.endsWith('.ts'))) {
    return new Response('bad hls asset', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/api/camera/hls/${encodeURIComponent(asset)}`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'andysottiaux.com/camera-hls-proxy' },
    })

    if (!upstream.ok || !upstream.body) {
      return new Response('hls upstream unavailable', {
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
  } catch {
    return new Response('hls upstream unreachable', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
