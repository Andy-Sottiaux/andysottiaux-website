export const CAMERA_HOST =
  process.env.NEXT_PUBLIC_V3_CAMERA_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export const PRIMARY_FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
export const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'webrtc,mse,mjpeg'
export const PLAYER_ASSET_VERSION = '20260603-instant-preview'

export const SNAPSHOT_URL = `${CAMERA_HOST}/api/camera/snapshot.jpeg`
export const SANITIZED_SNAPSHOT_URL = `${CAMERA_HOST}/api/camera/sanitized.jpeg`
export const MJPEG_URL = `${CAMERA_HOST}/api/camera/mjpeg`
export const QUALITY_URL = `${CAMERA_HOST}/api/camera/quality`
export const PLAYER_SCRIPT_URL = `${CAMERA_HOST}/video-stream.js?v=${PLAYER_ASSET_VERSION}`
