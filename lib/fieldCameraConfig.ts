export const CAMERA_HOST =
  process.env.NEXT_PUBLIC_V3_CAMERA_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export const PRIMARY_FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
export const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'webrtc,mse,mjpeg'

export const SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_SNAPSHOT_URL ||
  '/api/v3/camera/snapshot'
export const SANITIZED_SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_SANITIZED_SNAPSHOT_URL ||
  '/api/v3/camera/sanitized'
export const MJPEG_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_MJPEG_URL ||
  '/api/v3/camera/mjpeg'
export const QUALITY_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_QUALITY_URL ||
  '/api/v3/camera/quality'
export const TRAINING_STATUS_URL =
  process.env.NEXT_PUBLIC_V3_TRAINING_STATUS_URL ||
  '/api/v3/training/status'
