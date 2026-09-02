'use client'

import { LockKeyhole } from 'lucide-react'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'

type CameraIdleMode = 'play' | 'locked' | 'loading'

export default function CameraIdleSurface({
  selectedCamera = 'field',
  mode = 'play',
  onStart,
}: {
  selectedCamera?: FieldCameraSource
  mode?: CameraIdleMode
  onStart?: () => void
}) {
  const cameraLabel = selectedCamera === 'thingino' ? 'Cam 2' : 'Cam 1'
  const isPlayable = mode !== 'loading' && onStart
  const locked = mode === 'locked'

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(8,13,16,0.96), rgba(2,2,3,0.98) 58%, rgba(10,18,21,0.96))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      {isPlayable ? (
        <button
          type="button"
          aria-label={`${locked ? 'Unlock' : 'Play'} ${cameraLabel} live stream`}
          onClick={(event) => {
            event.stopPropagation()
            onStart()
          }}
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full text-white transition hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-cyan-300/80"
          style={{
            background: 'rgba(255,255,255,0.16)',
            border: '1px solid rgba(255,255,255,0.24)',
            boxShadow: '0 14px 36px rgba(0,0,0,0.42)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {locked ? (
            <LockKeyhole aria-hidden="true" className="h-5 w-5" />
          ) : (
            <span
              aria-hidden="true"
              className="ml-0.5 block h-0 w-0"
              style={{
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderLeft: '15px solid currentColor',
              }}
            />
          )}
        </button>
      ) : (
        <div
          className="relative z-10 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/66"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.16), rgba(255,255,255,0.05))',
            backgroundSize: '200% 100%',
            animation: 'cameraIdleShimmer 0.9s linear infinite',
          }}
        >
          camera
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/54 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/62">
        {selectedCamera === 'thingino' && (
          <span
            aria-hidden="true"
            className="block h-4 w-4 rounded-[5px] bg-white"
            style={{
              backgroundImage: 'url(/images/hatchingpoint-logo.jpeg)',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'cover',
            }}
          />
        )}
        {mode === 'loading' ? 'Camera loading' : locked ? `${cameraLabel} locked` : `${cameraLabel} paused`}
      </div>

      <style>{`
        @keyframes cameraIdleShimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  )
}
