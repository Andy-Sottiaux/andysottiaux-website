export function fallbackMediaResponse(kind: string) {
  if (
    process.env.V3_CAMERA_FALLBACK_MEDIA_ENABLED === '1' ||
    process.env.NEXT_PUBLIC_V3_CAMERA_FALLBACK_MEDIA_ENABLED === '1'
  ) {
    return null
  }

  return new Response(`${kind} disabled`, {
    status: 410,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
