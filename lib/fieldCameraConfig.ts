export const CAMERA_HOST =
  process.env.NEXT_PUBLIC_V3_CAMERA_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

export type FieldCameraSource = 'field' | 'thingino'

export const CAMERA_GATEWAY_HOST = process.env.NEXT_PUBLIC_V3_CAMERA_GATEWAY_HOST || ''

// Only set this to a true public tunnel host. Browsers can block direct .ts.net
// tailnet targets from the production site with Local/Private Network Access.
export const CAMERA_2_GATEWAY_HOST = process.env.NEXT_PUBLIC_V3_CAMERA_2_GATEWAY_HOST || ''
const CAMERA_2_GATEWAY_WS_HOST = CAMERA_2_GATEWAY_HOST.replace(/^http/i, 'ws')

export const CAMERA_2_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_URL ||
  (CAMERA_2_GATEWAY_HOST ? `${CAMERA_2_GATEWAY_HOST}/api/camera2/mjpeg` : '/api/v3/camera2/mjpeg')
export const CAMERA_2_NATIVE_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_NATIVE_URL ||
  CAMERA_2_URL
export const CAMERA_2_MJPEG_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_MJPEG_URL ||
  (CAMERA_2_GATEWAY_HOST ? `${CAMERA_2_GATEWAY_HOST}/api/camera2/mjpeg` : '/api/v3/camera2/mjpeg')
export const CAMERA_2_SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_SNAPSHOT_URL ||
  (CAMERA_2_GATEWAY_HOST ? `${CAMERA_2_GATEWAY_HOST}/api/camera2/snapshot` : '/api/v3/camera2/snapshot')
export const CAMERA_2_STATUS_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_STATUS_URL ||
  (CAMERA_2_GATEWAY_HOST ? `${CAMERA_2_GATEWAY_HOST}/api/camera2/status` : '/api/v3/camera2/status')
export const CAMERA_2_CONTROL_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_CONTROL_URL ||
  (CAMERA_2_GATEWAY_HOST ? `${CAMERA_2_GATEWAY_HOST}/api/camera2/control` : '/api/v3/camera2/control')
export const CAMERA_2_CONTROL_WS_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_CONTROL_WS_URL ||
  (CAMERA_2_GATEWAY_WS_HOST ? `${CAMERA_2_GATEWAY_WS_HOST}/api/camera2/control/ws` : '')
export const CAMERA_2_SETTINGS_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_SETTINGS_URL ||
  (CAMERA_2_GATEWAY_HOST ? `${CAMERA_2_GATEWAY_HOST}/api/camera2/settings` : '/api/v3/camera2/settings')
export const CAMERA_2_WEBRTC_OFFER_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_WEBRTC_OFFER_URL ||
  (CAMERA_2_GATEWAY_HOST ? `${CAMERA_2_GATEWAY_HOST}/api/webrtc` : '/api/v3/camera2/webrtc/offer')
export const CAMERA_2_WEBRTC_SOURCE_PARAM =
  process.env.NEXT_PUBLIC_V3_CAMERA_2_WEBRTC_SOURCE_PARAM ||
  (CAMERA_2_WEBRTC_OFFER_URL.includes('/api/webrtc') ? 'src' : 'stream')
export const CAMERA_2_STREAM = process.env.NEXT_PUBLIC_V3_CAMERA_2_STREAM || 'cam2'

export const PRIMARY_FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
export const PLAYER_MODE = process.env.NEXT_PUBLIC_V3_PLAYER_MODE || 'webrtc,mse,hls,mjpeg'
export const FAST_PLAYER_ENABLED = process.env.NEXT_PUBLIC_V3_FAST_PLAYER_ENABLED === '1'
export const HTTP_RTC_ENABLED = process.env.NEXT_PUBLIC_V3_HTTP_RTC_ENABLED !== '0'
export const CAMERA_FALLBACK_MEDIA_ENABLED = process.env.NEXT_PUBLIC_V3_CAMERA_FALLBACK_MEDIA_ENABLED === '1'

export const SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_SNAPSHOT_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/camera/snapshot.jpeg` : '/api/v3/camera/snapshot')
export const SANITIZED_SNAPSHOT_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_SANITIZED_SNAPSHOT_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/camera/sanitized.jpeg` : '/api/v3/camera/sanitized')
export const MJPEG_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_MJPEG_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/camera/mjpeg` : '/api/v3/camera/mjpeg')
export const HLS_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_HLS_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/camera/hls/clean.m3u8` : '/api/v3/camera/hls/clean.m3u8')
export const WEBRTC_OFFER_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_WEBRTC_OFFER_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/webrtc` : '/api/v3/camera/webrtc/offer')
export const WEBRTC_SOURCE_PARAM =
  process.env.NEXT_PUBLIC_V3_CAMERA_WEBRTC_SOURCE_PARAM ||
  (WEBRTC_OFFER_URL.includes('/api/webrtc') ? 'src' : 'stream')
export const QUALITY_URL =
  process.env.NEXT_PUBLIC_V3_CAMERA_QUALITY_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/camera/quality` : '/api/v3/camera/quality')
export const TRAINING_STATUS_URL =
  process.env.NEXT_PUBLIC_V3_TRAINING_STATUS_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/training/status` : '/api/v3/training/status')
export const HEALTH_URL =
  process.env.NEXT_PUBLIC_V3_HEALTH_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/health` : '/api/v3/health')
export const DETECTIONS_URL =
  process.env.NEXT_PUBLIC_V3_DETECTIONS_URL ||
  (CAMERA_GATEWAY_HOST ? `${CAMERA_GATEWAY_HOST}/api/detections` : '/api/v3/detections')
