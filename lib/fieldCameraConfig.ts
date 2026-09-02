export type FieldCameraSource = 'field' | 'thingino'

// Public Cloudflare hostnames are used only for the short-ticket Cam 2 control
// socket. Setting the explicit flag to "0" is the manual kill switch if a
// camera subdomain needs to be bypassed quickly.
const DIRECT_GATEWAY_DISABLED = process.env.NEXT_PUBLIC_V3_DIRECT_CAMERA_GATEWAY_ENABLED === '0'
const DIRECT_GATEWAY_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_V3_CAMERA_GATEWAY_HOST ||
  process.env.NEXT_PUBLIC_V3_CAMERA_2_GATEWAY_HOST ||
  process.env.NEXT_PUBLIC_V3_CAMERA_2_FALLBACK_GATEWAY_HOST
)
const DIRECT_GATEWAY_ENABLED =
  !DIRECT_GATEWAY_DISABLED &&
  (process.env.NEXT_PUBLIC_V3_DIRECT_CAMERA_GATEWAY_ENABLED === '1' || DIRECT_GATEWAY_CONFIGURED)

export const CAMERA_GATEWAY_HOST =
  DIRECT_GATEWAY_ENABLED
    ? (process.env.NEXT_PUBLIC_V3_CAMERA_GATEWAY_HOST || '')
    : ''

// Only set this to a true public tunnel host. Browsers can block direct .ts.net
// tailnet targets from the production site with Local/Private Network Access.
// The shared Cloudflare gateway routes both Cam 1 and Cam 2 APIs. A dedicated
// Cam 2 host can be supplied once that hostname is healthy.
export const CAMERA_2_GATEWAY_HOST =
  DIRECT_GATEWAY_ENABLED
    ? (process.env.NEXT_PUBLIC_V3_CAMERA_2_GATEWAY_HOST || CAMERA_GATEWAY_HOST)
    : ''
const CAMERA_2_GATEWAY_WS_HOST = CAMERA_2_GATEWAY_HOST.replace(/^http/i, 'ws')
const CAMERA_2_FALLBACK_GATEWAY_HOST =
  DIRECT_GATEWAY_ENABLED
    ? (process.env.NEXT_PUBLIC_V3_CAMERA_2_FALLBACK_GATEWAY_HOST || CAMERA_GATEWAY_HOST)
    : ''
const CAMERA_2_FALLBACK_GATEWAY_WS_HOST = CAMERA_2_FALLBACK_GATEWAY_HOST.replace(/^http/i, 'ws')

// Camera media always crosses the authenticated same-origin API. Public
// NEXT_PUBLIC overrides would let a browser bypass the signed session.
export const CAMERA_2_MJPEG_URL = '/api/v3/camera2/mjpeg'
export const CAMERA_2_SNAPSHOT_URL = '/api/v3/camera2/snapshot'
export const CAMERA_2_STATUS_URL = '/api/v3/camera2/status'
// HTTP writes stay on the same origin so the browser never receives the relay
// credential. Only the short-ticket Cam 2 WebSocket uses a gateway directly.
export const CAMERA_2_CONTROL_URL = '/api/v3/camera2/control'
export const CAMERA_2_CONTROL_FALLBACK_URL = ''
export const CAMERA_2_CONTROL_WS_URL = CAMERA_2_GATEWAY_WS_HOST
  ? `${CAMERA_2_GATEWAY_WS_HOST}/api/camera2/control/ws`
  : ''
export const CAMERA_2_CONTROL_WS_FALLBACK_URL = CAMERA_2_FALLBACK_GATEWAY_WS_HOST
  ? `${CAMERA_2_FALLBACK_GATEWAY_WS_HOST}/api/camera2/control/ws`
  : ''
export const CAMERA_2_SETTINGS_URL = '/api/v3/camera2/settings'
export const CAMERA_2_SETTINGS_FALLBACK_URL = ''
export const CAMERA_2_WEBRTC_OFFER_URL = '/api/v3/camera2/webrtc/offer'
export const CAMERA_2_WEBRTC_SOURCE_PARAM = 'stream'
export const CAMERA_2_STREAM = process.env.NEXT_PUBLIC_V3_CAMERA_2_STREAM || 'cam2'

export const PRIMARY_FEED_STREAM = process.env.NEXT_PUBLIC_V3_FEED_STREAM || 'cayley-sub'
export const HTTP_RTC_ENABLED = process.env.NEXT_PUBLIC_V3_HTTP_RTC_ENABLED !== '0'
// Fallback media only starts after the user presses play, but it must be
// available when WebRTC cannot establish from a public viewer's network.
export const CAMERA_FALLBACK_MEDIA_ENABLED = process.env.NEXT_PUBLIC_V3_CAMERA_FALLBACK_MEDIA_ENABLED !== '0'

export const SNAPSHOT_URL = '/api/v3/camera/snapshot'
export const MJPEG_URL = '/api/v3/camera/mjpeg'
export const HLS_URL = '/api/v3/camera/hls/clean.m3u8'
export const WEBRTC_OFFER_URL = '/api/v3/camera/webrtc/offer'
export const WEBRTC_SOURCE_PARAM = 'stream'
export const QUALITY_URL = '/api/v3/camera/quality'
export const TRAINING_STATUS_URL = '/api/v3/training/status'
export const HEALTH_URL =
  process.env.NEXT_PUBLIC_V3_HEALTH_URL ||
  '/api/v3/health'
export const DETECTIONS_URL = '/api/v3/detections'
