import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: '#1a1a1a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          borderRadius: '6px',
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        AS
      </div>
    ),
    {
      ...size,
    }
  )
}
