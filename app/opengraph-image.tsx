import { ImageResponse } from 'next/og'

export const alt = 'Andy Sottiaux, engineer and founder. I build across the boundaries.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '46px 64px 40px',
          background: '#121513',
          color: '#f0eee8',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 26, borderBottom: '1px solid #353a34' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 9, height: 9, background: '#f49a6c', borderRadius: '50%' }} />
            <span style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.5px' }}>Andy Sottiaux</span>
          </div>
          <span style={{ fontSize: 15, letterSpacing: '2px', color: '#aeb5aa' }}>ENGINEER & FOUNDER</span>
        </div>

        <div style={{ position: 'absolute', right: 38, top: 169, width: 286, height: 280, display: 'flex' }}>
          <svg width="286" height="280" viewBox="0 0 286 280" fill="none">
            <circle cx="140" cy="133" r="109" stroke="#4b5348" strokeWidth="1" />
            <circle cx="140" cy="133" r="83" stroke="#4b5348" strokeWidth="1" />
            <path d="M140 8V34M140 232V258M15 133H41M239 133H265" stroke="#a6af9d" strokeWidth="1" />
            <path d="M63 56L81 74M199 192L217 210M63 210L81 192M199 74L217 56" stroke="#4b5348" strokeWidth="1" />
            <rect x="101" y="94" width="78" height="78" rx="4" fill="#1c221c" stroke="#d9dfcb" strokeWidth="1.5" />
            <rect x="112" y="105" width="56" height="56" rx="1" stroke="#4b5348" strokeWidth="1" />
            <path d="M115 81V94M132 81V94M149 81V94M166 81V94M115 172V185M132 172V185M149 172V185M166 172V185M88 108H101M88 125H101M88 142H101M88 159H101M179 108H192M179 125H192M179 142H192M179 159H192" stroke="#a6af9d" strokeWidth="1" />
            <path d="M128 123L118 133L128 143M152 123L162 133L152 143M144 119L136 147" stroke="#f49a6c" strokeWidth="2" />
            <circle cx="140" cy="24" r="4" fill="#f49a6c" />
            <circle cx="223" cy="133" r="4" fill="#d9dfcb" />
            <circle cx="31" cy="133" r="3" fill="#d9dfcb" />
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 51, width: 815 }}>
          <span style={{ fontSize: 86, fontWeight: 600, letterSpacing: '-4px', lineHeight: 1.08 }}>I build across</span>
          <span style={{ fontSize: 86, fontWeight: 600, letterSpacing: '-4px', lineHeight: 1.08, color: '#d9dfcb' }}>the boundaries.</span>
          <span style={{ fontSize: 22, lineHeight: 1.5, color: '#aeb5aa', marginTop: 24, width: 650 }}>
            Aerospace. Embedded systems. Robotics. Production apps.
          </span>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #353a34', paddingTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 27, fontSize: 13, letterSpacing: '1.5px', color: '#aeb5aa' }}>
            <span>PHYSICAL</span>
            <svg width="23" height="12" viewBox="0 0 23 12" fill="none"><path d="M1 6H22M5 2L1 6L5 10M18 2L22 6L18 10" stroke="#f49a6c" strokeWidth="1" /></svg>
            <span>DIGITAL</span>
            <svg width="23" height="12" viewBox="0 0 23 12" fill="none"><path d="M1 6H22M5 2L1 6L5 10M18 2L22 6L18 10" stroke="#f49a6c" strokeWidth="1" /></svg>
            <span>HUMAN</span>
          </div>
          <span style={{ fontSize: 17, color: '#f0eee8' }}>andysottiaux.com</span>
        </div>
      </div>
    ),
    size,
  )
}
