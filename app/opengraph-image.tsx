import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'

export const alt = 'Andy Sottiaux - Software Engineer & Entrepreneur'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          backgroundImage: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)',
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            backgroundColor: '#1a1a1a',
          }}
        />

        {/* Main content container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
          }}
        >
          {/* Initials circle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '120px',
              height: '120px',
              borderRadius: '60px',
              backgroundColor: '#1a1a1a',
              marginBottom: '32px',
            }}
          >
            <span
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#ffffff',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              AS
            </span>
          </div>

          {/* Name */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 700,
              color: '#1a1a1a',
              margin: '0 0 16px 0',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Andy Sottiaux
          </h1>

          {/* Title */}
          <p
            style={{
              fontSize: '32px',
              color: '#4a4a4a',
              margin: '0 0 24px 0',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Software Engineer & Entrepreneur
          </p>

          {/* Tags */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
            }}
          >
            {['AVX Aircraft', 'Bell Flight', 'Full Stack Dev'].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  borderRadius: '24px',
                  fontSize: '20px',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* Website URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '24px',
            color: '#6a6a6a',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          andysottiaux.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
