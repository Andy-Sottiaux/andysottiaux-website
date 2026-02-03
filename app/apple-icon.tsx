import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 100,
          background: '#1a1a1a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          borderRadius: '36px',
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
