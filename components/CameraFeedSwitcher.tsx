'use client'

import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import CameraIdleSurface from './CameraIdleSurface'
import { useControlAuth } from './ControlAuthProvider'
import FieldCameraFeed from './FieldCameraFeed'
import ThinginoCameraFeed from './ThinginoCameraFeed'

type VideoFit = 'contain' | 'cover' | 'fill'

export default function CameraFeedSwitcher({
  selectedCamera = 'field',
  enabled = true,
  fit = 'contain',
  position = 'center center',
  onStart,
}: {
  selectedCamera?: FieldCameraSource
  enabled?: boolean
  fit?: VideoFit
  position?: string
  onStart?: () => void
}) {
  const { unlocked, requestUnlock } = useControlAuth()

  if (!enabled || !unlocked) {
    const canStart = enabled || Boolean(onStart)
    const start = () => {
      onStart?.()
      if (!unlocked) void requestUnlock()
    }
    return (
      <CameraIdleSurface
        selectedCamera={selectedCamera}
        mode={unlocked ? 'play' : 'locked'}
        onStart={canStart ? start : undefined}
      />
    )
  }

  if (selectedCamera === 'thingino') {
    return <ThinginoCameraFeed fit={fit} position={position} />
  }

  return <FieldCameraFeed enabled={enabled} fit={fit} position={position} />
}
