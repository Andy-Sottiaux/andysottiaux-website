'use client'

import { useState } from 'react'
import {
  CAMERA_2_MJPEG_URL,
  CAMERA_2_NATIVE_URL,
  CAMERA_2_SNAPSHOT_URL,
  CAMERA_2_URL,
} from '@/lib/fieldCameraConfig'
import { useFieldTheme } from './fieldTheme'

type VideoFit = 'contain' | 'cover' | 'fill'

export default function ThinginoCameraFeed({
  fit = 'contain',
  position = 'center center',
}: {
  fit?: VideoFit
  position?: string
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const [streamVersion, setStreamVersion] = useState(0)
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [streamReady, setStreamReady] = useState(false)
  const [streamFailed, setStreamFailed] = useState(false)
  const mjpegUrl = `${CAMERA_2_MJPEG_URL}?v=${streamVersion}`
  const snapshotUrl = `${CAMERA_2_SNAPSHOT_URL}?v=${streamVersion}`

  const reload = () => {
    setSnapshotReady(false)
    setStreamReady(false)
    setStreamFailed(false)
    setStreamVersion(Date.now())
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-black">
      <img
        src={snapshotUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full"
        onLoad={() => setSnapshotReady(true)}
        onError={() => setSnapshotReady(false)}
        style={{
          objectFit: fit,
          objectPosition: position,
          opacity: streamReady ? 0 : snapshotReady ? 1 : 0,
          transition: 'opacity 240ms ease',
          filter: 'saturate(1.02) contrast(1.03)',
        }}
      />

      <img
        key={streamVersion}
        src={mjpegUrl}
        alt=""
        aria-label="HatchingPoint Cam 2 live preview"
        className="absolute inset-0 h-full w-full"
        onLoad={() => {
          setStreamReady(true)
          setStreamFailed(false)
        }}
        onError={() => {
          setStreamReady(false)
          setStreamFailed(true)
        }}
        style={{
          objectFit: fit,
          objectPosition: position,
          opacity: streamReady ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      />

      {!snapshotReady && !streamReady && !streamFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase text-white/70"
            style={{
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.16), rgba(255,255,255,0.05))',
              backgroundSize: '200% 100%',
              animation: 'thinginoShimmer 1.2s linear infinite',
            }}
          >
            opening cam 2...
          </div>
        </div>
      )}

      {streamFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
          <div className="flex max-w-[18rem] flex-col items-center gap-3">
            <img
              src="/images/hatchingpoint-mark.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9"
              style={{ filter: isLight ? 'none' : 'drop-shadow(0 0 10px rgba(255,255,255,0.16))' }}
            />
            <div className="text-[11px] font-semibold uppercase text-white/76">
              Cam 2 tailnet unavailable
            </div>
            <button
              type="button"
              onClick={reload}
              className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase text-white/85 transition hover:text-white"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              retry
            </button>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full px-2.5 py-1"
        style={{
          background: 'rgba(0,0,0,0.62)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <img src="/images/hatchingpoint-mark.png" alt="" aria-hidden="true" className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase">HatchingPoint / Cam 2</span>
      </div>

      <div
        className="pointer-events-none absolute right-3 top-3 hidden rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase sm:block"
        style={{
          background: 'rgba(0,0,0,0.58)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        Thingino E220 / Tailnet
      </div>

      <a
        href={CAMERA_2_NATIVE_URL || CAMERA_2_URL}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase opacity-70 transition-opacity hover:opacity-100"
        style={{
          background: 'rgba(0,0,0,0.58)',
          color: '#fff',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        open
      </a>

      <style jsx global>{`
        @keyframes thinginoShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
