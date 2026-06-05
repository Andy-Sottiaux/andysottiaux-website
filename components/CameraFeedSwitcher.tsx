'use client'

import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import FieldCameraFeed from './FieldCameraFeed'
import ThinginoCameraFeed from './ThinginoCameraFeed'

type VideoFit = 'contain' | 'cover' | 'fill'

export default function CameraFeedSwitcher({
  selectedCamera = 'field',
  enabled = true,
  fit = 'contain',
  position = 'center center',
}: {
  selectedCamera?: FieldCameraSource
  enabled?: boolean
  fit?: VideoFit
  position?: string
}) {
  if (selectedCamera === 'thingino') {
    return <ThinginoCameraFeed fit={fit} position={position} />
  }

  return <FieldCameraFeed enabled={enabled} fit={fit} position={position} />
}
