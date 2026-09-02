#!/usr/bin/env node

const targetUrl = process.env.PRODUCTION_HEALTH_URL || process.argv[2] || 'https://andysottiaux.com'
const cameraCookie = process.env.PRODUCTION_HEALTH_CAMERA_COOKIE?.trim() || ''

const budgets = {
  timeoutMs: Number.parseInt(process.env.PRODUCTION_HEALTH_TIMEOUT_MS || '10000', 10),
  solarMaxAgeSeconds: Number.parseInt(process.env.PRODUCTION_HEALTH_SOLAR_MAX_AGE_SECONDS || '1800', 10),
  cam1MinWidth: Number.parseInt(process.env.PRODUCTION_HEALTH_CAM1_MIN_WIDTH || '1280', 10),
  cam1MinFps: Number.parseInt(process.env.PRODUCTION_HEALTH_CAM1_MIN_FPS || '24', 10),
  cam1TargetFps: Number.parseInt(process.env.PRODUCTION_HEALTH_CAM1_TARGET_FPS || '24', 10),
  cam2MinWidth: Number.parseInt(process.env.PRODUCTION_HEALTH_CAM2_MIN_WIDTH || '1920', 10),
  cam2MinFps: Number.parseInt(process.env.PRODUCTION_HEALTH_CAM2_MIN_FPS || '24', 10),
  cam2MinBitrate: Number.parseInt(process.env.PRODUCTION_HEALTH_CAM2_MIN_BITRATE || '8000', 10),
}

const cam1RknnHealthyStates = new Set(['running', 'ready', 'ok'])

function endpoint(path) {
  return new URL(path, targetUrl).toString()
}

function elapsed(start) {
  return Math.round(performance.now() - start)
}

async function readText(path, timeoutMs = budgets.timeoutMs, extraHeaders = {}, requestInit = {}) {
  const started = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint(path), {
      ...requestInit,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'andysottiaux.com-production-health-monitor',
        ...extraHeaders,
        ...(requestInit.headers || {}),
      },
    })
    const body = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      latency_ms: elapsed(started),
      bytes: Buffer.byteLength(body),
      body,
    }
  } catch (error) {
    return {
      ok: false,
      latency_ms: elapsed(started),
      error: error instanceof Error ? error.message : String(error),
      body: '',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function readJson(path, timeoutMs = budgets.timeoutMs, extraHeaders = {}) {
  const started = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint(path), {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'andysottiaux.com-production-health-monitor',
        ...extraHeaders,
      },
    })
    const body = await response.json().catch(() => null)
    return {
      ok: response.ok && body !== null,
      status: response.status,
      latency_ms: elapsed(started),
      data: body,
    }
  } catch (error) {
    return {
      ok: false,
      latency_ms: elapsed(started),
      error: error instanceof Error ? error.message : String(error),
      data: null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function timestampAgeSeconds(value) {
  const ts = numeric(value)
  if (!ts) return null
  const millis = ts > 10_000_000_000 ? ts : ts * 1000
  return Math.max(0, Math.round((Date.now() - millis) / 1000))
}

function parseResolution(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/(\d+)\s*x\s*(\d+)/i)
  if (!match) return null
  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  }
}

function pushFailure(failures, check, message, details = {}) {
  failures.push({ check, message, ...details })
}

function pushWarning(warnings, check, message, details = {}) {
  warnings.push({ check, message, ...details })
}

const cameraHeaders = cameraCookie ? { Cookie: cameraCookie } : {}
const [
  home,
  cam1,
  cam2,
  cam1Snapshot,
  cam2Snapshot,
  cam1Mjpeg,
  cam2Mjpeg,
  cam1Hls,
  cam1Quality,
  cam2Status,
  cam2Settings,
  detections,
  training,
  cam1Webrtc,
  cam2Webrtc,
  solar,
  solarHistory,
  fundraising,
] = await Promise.all([
  readText('/'),
  readJson('/api/v3/camera/diagnostics', budgets.timeoutMs, cameraHeaders),
  readJson('/api/v3/camera2/diagnostics', budgets.timeoutMs, cameraHeaders),
  readText('/api/v3/camera/snapshot', budgets.timeoutMs, cameraHeaders),
  readText('/api/v3/camera2/snapshot', budgets.timeoutMs, cameraHeaders),
  readText('/api/v3/camera/mjpeg', budgets.timeoutMs, cameraHeaders, { method: 'HEAD' }),
  readText('/api/v3/camera2/mjpeg', budgets.timeoutMs, cameraHeaders, { method: 'HEAD' }),
  readText('/api/v3/camera/hls/clean.m3u8', budgets.timeoutMs, cameraHeaders),
  readJson('/api/v3/camera/quality', budgets.timeoutMs, cameraHeaders),
  readJson('/api/v3/camera2/status', budgets.timeoutMs, cameraHeaders),
  readJson('/api/v3/camera2/settings', budgets.timeoutMs, cameraHeaders),
  readJson('/api/v3/detections', budgets.timeoutMs, cameraHeaders),
  readJson('/api/v3/training/status', budgets.timeoutMs, cameraHeaders),
  readText('/api/v3/camera/webrtc/offer', budgets.timeoutMs, cameraHeaders, {
    method: 'POST',
    body: 'invalid offer',
    headers: { 'Content-Type': 'application/sdp' },
  }),
  readText('/api/v3/camera2/webrtc/offer', budgets.timeoutMs, cameraHeaders, {
    method: 'POST',
    body: 'invalid offer',
    headers: { 'Content-Type': 'application/sdp' },
  }),
  readJson('/api/v3/solar'),
  readJson('/api/v3/solar/history?points=72'),
  readJson('/api/fundraising'),
])

const failures = []
const warnings = []
const publicCameraChecks = [
  ['cam1_diagnostics', cam1],
  ['cam2_diagnostics', cam2],
  ['cam1_snapshot', cam1Snapshot],
  ['cam2_snapshot', cam2Snapshot],
  ['cam1_mjpeg', cam1Mjpeg],
  ['cam2_mjpeg', cam2Mjpeg],
  ['cam1_hls', cam1Hls],
  ['cam1_quality', cam1Quality],
  ['cam2_status', cam2Status],
  ['cam2_settings', cam2Settings],
  ['detections', detections],
  ['training', training],
  ['cam1_webrtc', cam1Webrtc],
  ['cam2_webrtc', cam2Webrtc],
]
const camerasAreProtected = !cameraCookie && publicCameraChecks.every(([, check]) => check.status === 401)

if (!home.ok || !home.body.includes('Andy Sottiaux')) {
  pushFailure(failures, 'homepage', 'Homepage did not load the expected portfolio shell.', {
    status: home.status,
    error: home.error,
  })
}

if (!cameraCookie) {
  for (const [name, check] of publicCameraChecks) {
    if (check.status !== 401) {
      pushFailure(failures, `camera_privacy_${name}`, 'A camera endpoint did not enforce an access session.', {
        status: check.status,
        error: check.error,
      })
    }
  }
}

const cam1Data = cam1.data
const cam1Summary = cam1Data?.summary ?? {}
const cam1Resolution = parseResolution(cam1Summary.resolution)
if (camerasAreProtected) {
  // Public monitoring verifies the privacy boundary. Supply a short-lived
  // signed session cookie only when detailed private camera health is needed.
} else if (!cam1.ok || cam1Data?.ok !== true) {
  pushFailure(failures, 'cam1', 'Cam1 diagnostics are not fully healthy.', {
    status: cam1.status,
    summary: cam1Summary,
  })
} else {
  if (cam1Resolution && cam1Resolution.width < budgets.cam1MinWidth) {
    pushFailure(failures, 'cam1_resolution', 'Cam1 width is below budget.', {
      resolution: cam1Summary.resolution,
      minWidth: budgets.cam1MinWidth,
    })
  }
  if (numeric(cam1Summary.fps) !== null && cam1Summary.fps < budgets.cam1MinFps) {
    pushFailure(failures, 'cam1_fps', 'Cam1 FPS is below budget.', {
      fps: cam1Summary.fps,
      minFps: budgets.cam1MinFps,
    })
  }
  if (numeric(cam1Summary.fps) !== null && cam1Summary.fps < budgets.cam1TargetFps) {
    pushWarning(warnings, 'cam1_fps_target', 'Cam1 FPS is below the preferred target.', {
      fps: cam1Summary.fps,
      targetFps: budgets.cam1TargetFps,
    })
  }
  if (
    typeof cam1Summary.rknn_state === 'string' &&
    !cam1RknnHealthyStates.has(cam1Summary.rknn_state)
  ) {
    pushWarning(warnings, 'cam1_rknn', 'Cam1 inference is not reporting a running state.', {
      state: cam1Summary.rknn_state,
      fps: cam1Summary.rknn_fps,
    })
  }
  if (!cam1Resolution) {
    pushWarning(warnings, 'cam1_resolution', 'Cam1 diagnostics did not report a parsed resolution.', {
      resolution: cam1Summary.resolution,
    })
  }
}

const cam2Data = cam2.data
const cam2Summary = cam2Data?.summary ?? {}
const cam2Resolution = parseResolution(cam2Summary.resolution)
if (camerasAreProtected) {
  // See Cam1 above: a 401 is the healthy public state.
} else if (!cam2.ok || cam2Data?.ok !== true) {
  pushFailure(failures, 'cam2', 'Cam2 diagnostics are not fully healthy.', {
    status: cam2.status,
    summary: cam2Summary,
  })
} else {
  if (!cam2Resolution || cam2Resolution.width < budgets.cam2MinWidth) {
    pushFailure(failures, 'cam2_resolution', 'Cam2 width is below budget.', {
      resolution: cam2Summary.resolution,
      minWidth: budgets.cam2MinWidth,
    })
  }
  if (numeric(cam2Summary.fps) === null || cam2Summary.fps < budgets.cam2MinFps) {
    pushFailure(failures, 'cam2_fps', 'Cam2 FPS is below budget.', {
      fps: cam2Summary.fps,
      minFps: budgets.cam2MinFps,
    })
  }
  if (numeric(cam2Summary.bitrate) === null || cam2Summary.bitrate < budgets.cam2MinBitrate) {
    pushFailure(failures, 'cam2_bitrate', 'Cam2 bitrate is below budget.', {
      bitrate: cam2Summary.bitrate,
      minBitrate: budgets.cam2MinBitrate,
    })
  }
  if (cam2Summary.control_transport !== 'websocket' || cam2Summary.control_mode !== 'vector') {
    pushFailure(failures, 'cam2_control', 'Cam2 is not reporting the smooth WebSocket vector-control path.', {
      transport: cam2Summary.control_transport,
      mode: cam2Summary.control_mode,
    })
  }
}

const solarData = solar.data
const solarAgeSeconds = timestampAgeSeconds(solarData?.timestamp)
if (!solar.ok || solarData?.error || solarData?.stale === true) {
  pushFailure(failures, 'solar', 'Solar telemetry is unavailable or marked stale.', {
    status: solar.status,
    stale: solarData?.stale,
    error: solarData?.error,
  })
}
if (solarAgeSeconds === null) {
  pushWarning(warnings, 'solar_freshness', 'Solar telemetry did not include a timestamp.')
} else if (solarAgeSeconds > budgets.solarMaxAgeSeconds) {
  pushFailure(failures, 'solar_freshness', 'Solar telemetry is older than budget.', {
    ageSeconds: solarAgeSeconds,
    maxAgeSeconds: budgets.solarMaxAgeSeconds,
  })
}

const historyPoints =
  Array.isArray(solarHistory.data?.points)
    ? solarHistory.data.points.length
    : Array.isArray(solarHistory.data)
      ? solarHistory.data.length
      : 0
if (!solarHistory.ok || historyPoints === 0) {
  pushFailure(failures, 'solar_history', 'Solar history did not return chartable points.', {
    status: solarHistory.status,
    points: historyPoints,
  })
}

const fundraisingData = fundraising.data
if (!fundraising.ok || numeric(fundraisingData?.goal) === null) {
  pushFailure(failures, 'fundraising', 'Fundraising endpoint did not return a usable goal.', {
    status: fundraising.status,
  })
}
if (fundraising.ok && numeric(fundraisingData?.raised) === null) {
  pushWarning(warnings, 'fundraising_raised', 'Fundraising endpoint loaded, but raised amount was unavailable.')
}

const result = {
  ok: failures.length === 0,
  targetUrl,
  checked_at: new Date().toISOString(),
  budgets,
  failures,
  warnings,
  summary: {
    homepage: {
      status: home.status,
      latency_ms: home.latency_ms,
      bytes: home.bytes,
    },
    cam1: {
      status: cam1.status,
      latency_ms: cam1.latency_ms,
      protected: camerasAreProtected,
      ok: camerasAreProtected || cam1Data?.ok === true,
      summary: cam1Summary,
    },
    cam2: {
      status: cam2.status,
      latency_ms: cam2.latency_ms,
      protected: camerasAreProtected,
      ok: camerasAreProtected || cam2Data?.ok === true,
      summary: cam2Summary,
    },
    solar: {
      status: solar.status,
      latency_ms: solar.latency_ms,
      age_seconds: solarAgeSeconds,
      battery_voltage: solarData?.battery_voltage ?? null,
      solar_power: solarData?.solar_power ?? null,
    },
    solarHistory: {
      status: solarHistory.status,
      latency_ms: solarHistory.latency_ms,
      points: historyPoints,
    },
    fundraising: {
      status: fundraising.status,
      latency_ms: fundraising.latency_ms,
      raised: fundraisingData?.raised ?? null,
      goal: fundraisingData?.goal ?? null,
    },
  },
}

const output = JSON.stringify(result, null, 2)
if (!result.ok) {
  console.error(output)
  process.exit(1)
}

console.log(output)
