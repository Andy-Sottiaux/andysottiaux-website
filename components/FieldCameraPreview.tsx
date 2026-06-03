'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import { SNAPSHOT_URL } from '@/lib/fieldCameraConfig'

type VideoFit = 'contain' | 'cover' | 'fill'

export default function FieldCameraPreview({
  fit = 'contain',
  position = 'center center',
  muted = false,
}: {
  fit?: VideoFit
  position?: string
  muted?: boolean
}) {
  const [version, setVersion] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setVersion(Date.now())
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <img
        src={`${SNAPSHOT_URL}?v=${version}`}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300"
        style={{
          objectFit: fit,
          objectPosition: position,
          opacity: loaded ? (muted ? 0.68 : 1) : 0,
          filter: muted ? 'saturate(0.92) contrast(1.04) brightness(0.8)' : 'saturate(1.02) contrast(1.03)',
        } as CSSProperties}
      />
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: loaded ? 0.08 : 0.54,
          background:
            'linear-gradient(105deg, rgba(10,10,12,0.66) 25%, rgba(22,22,26,0.74) 50%, rgba(10,10,12,0.66) 75%)',
          backgroundSize: '200% 100%',
          animation: 'fldShimmer 2.4s linear infinite',
        }}
      />
    </div>
  )
}
