/** Server-only consumers: route handlers and the initial server-rendered probe. */
type Endpoint = 'health' | 'solar' | 'history'
type Environment = Partial<Record<'V3_HEALTH_UPSTREAM_HOST' | 'V3_SOLAR_UPSTREAM_HOST' | 'V3_SOLAR_HISTORY_UPSTREAM_HOST' | 'V3_UPSTREAM_HOST', string>>

export function resolveFieldUpstream(endpoint: Endpoint, env: Environment = {
  V3_HEALTH_UPSTREAM_HOST: process.env.V3_HEALTH_UPSTREAM_HOST,
  V3_SOLAR_UPSTREAM_HOST: process.env.V3_SOLAR_UPSTREAM_HOST,
  V3_SOLAR_HISTORY_UPSTREAM_HOST: process.env.V3_SOLAR_HISTORY_UPSTREAM_HOST,
  V3_UPSTREAM_HOST: process.env.V3_UPSTREAM_HOST,
}) {
  const value = (endpoint === 'health' ? env.V3_HEALTH_UPSTREAM_HOST : endpoint === 'history' ? env.V3_SOLAR_HISTORY_UPSTREAM_HOST || env.V3_SOLAR_UPSTREAM_HOST : env.V3_SOLAR_UPSTREAM_HOST)
    || env.V3_UPSTREAM_HOST || 'https://cayley-relay.tailc7d6b6.ts.net'
  const url = new URL(value.trim().replace(/\/+$/, ''))
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('upstream_configuration')
  return url.toString().replace(/\/+$/, '')
}

export async function readFieldTelemetry(endpoint: Endpoint, path: string, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let base: string
    try { base = resolveFieldUpstream(endpoint) } catch { return { ok: false as const, status: 502, error: 'upstream_configuration' } }
    const response = await fetch(`${base}${path}`, { cache: 'no-store', signal: controller.signal, headers: { 'User-Agent': 'andysottiaux.com/telemetry' } })
    if (!response.ok) return { ok: false as const, status: 502, error: 'upstream_status' }
    try {
      const body: unknown = await response.json()
      return { ok: true as const, status: 200, body }
    } catch {
      return { ok: false as const, status: controller.signal.aborted ? 504 : 502, error: controller.signal.aborted ? 'upstream_timeout' : 'upstream_invalid_json' }
    }
  } catch {
    return { ok: false as const, status: controller.signal.aborted ? 504 : 502, error: controller.signal.aborted ? 'upstream_timeout' : 'upstream_unreachable' }
  } finally {
    clearTimeout(timeout)
  }
}
