export const CAMERA_HOST =
  process.env.NEXT_PUBLIC_V3_CAMERA_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export type FieldCameraSource = 'field' | 'thingino'

export const CAMERA_2_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_URL ||
  '/api/v3/camera2/mjpeg'
export const CAMERA_2_NATIVE_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_NATIVE_URL ||
  CAMERA_2_URL
export const CAMERA_2_MJPEG_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_MJPEG_URL ||
  '/api/v3/camera2/mjpeg'
export const CAMERA_2_SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_SNAPSHOT_URL ||
  '/api/v3/camera2/snapshot'
export const CAMERA_2_STATUS_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_STATUS_URL ||
  '/api/v3/camera2/status'
export const CAMERA_2_CONTROL_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_CONTROL_URL ||
  '/api/v3/camera2/control'
export const CAMERA_2_SETTINGS_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_SETTINGS_URL ||
  '/api/v3/camera2/settings'

export const PRIMARY_FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
export const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'webrtc,mse,hls,mjpeg'
export const FAST_PLAYER_ENABLED = process.env.NEXT_PUBLIC_V3_FAST_PLAYER_ENABLED === '1'
export const HTTP_RTC_ENABLED = process.env.NEXT_PUBLIC_V3_HTTP_RTC_ENABLED !== '0'

export const SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_SNAPSHOT_URL ||
  '/api/v3/camera/snapshot'
export const SANITIZED_SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_SANITIZED_SNAPSHOT_URL ||
  '/api/v3/camera/sanitized'
export const MJPEG_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_MJPEG_URL ||
  '/api/v3/camera/mjpeg'
export const HLS_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_HLS_URL ||
  '/api/v3/camera/hls/clean.m3u8'
export const WEBRTC_OFFER_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_WEBRTC_OFFER_URL ||
  '/api/v3/camera/webrtc/offer'
export const QUALITY_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_QUALITY_URL ||
  '/api/v3/camera/quality'
export const TRAINING_STATUS_URL =
  process.env.NEXT_PUBLIC_V3_TRAINING_STATUS_URL ||
  '/api/v3/training/status'
