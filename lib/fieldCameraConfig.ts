export const CAMERA_HOST =
  process.env.NEXT_PUBLIC_V3_CAMERA_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

const CAMERA_BASE = CAMERA_HOST.replace(/\/+$/, '')

function cameraEndpoint(override: string | undefined, path: string) {
  return override || `${CAMERA_BASE}${path}`
}

export const PRIMARY_FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
export const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'webrtc,mse,mjpeg'

export const SNAPSHOT_URL = cameraEndpoint(
  process.env.NEXT_PUBLIC_V3_CAMERA_SNAPSHOT_URL,
  '/api/camera/snapshot.jpeg'
)
export const SANITIZED_SNAPSHOT_URL = cameraEndpoint(
  process.env.NEXT_PUBLIC_V3_CAMERA_SANITIZED_SNAPSHOT_URL,
  '/api/camera/sanitized.jpeg'
)
export const MJPEG_URL = cameraEndpoint(
  process.env.NEXT_PUBLIC_V3_CAMERA_MJPEG_URL,
  '/api/camera/mjpeg'
)
export const QUALITY_URL = cameraEndpoint(
  process.env.NEXT_PUBLIC_V3_CAMERA_QUALITY_URL,
  '/api/camera/quality'
)
export const TRAINING_STATUS_URL = cameraEndpoint(
  process.env.NEXT_PUBLIC_V3_TRAINING_STATUS_URL,
  '/api/training/status'
)
