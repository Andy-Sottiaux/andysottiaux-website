import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM = process.env.V3_UPSTREAM_HOST || 'https://cayley-v3-cam-1.tailc7d6b6.ts.net'
const ALLOWED_FILES = new Set(['video-rtc.js'])

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const file = params.file
  if (!ALLOWED_FILES.has(file)) {
    return new NextResponse('not found', { status: 404 })
  }

  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), 8000)

  try {
    const upstream = await fetch(`${UPSTREAM}/${file}`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/go2rtc-client-proxy' },
    })

    if (!upstream.ok) {
      return new NextResponse('upstream ' + upstream.status, { status: 502 })
    }

    const body = await upstream.text()
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch {
    return new NextResponse('unreachable', { status: 502 })
  } finally {
    clearTimeout(timeoutId)
  }
}
