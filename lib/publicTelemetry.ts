/** Explicit public schemas. Never spread upstream objects into browser responses. */
type RecordValue = Record<string, unknown>
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const boolean = (value: unknown): boolean | undefined => typeof value === 'boolean' ? value : undefined
const PUBLIC_TOKENS = new Set('ok running active inactive failed error unknown unavailable available online offline stale watch degraded starting stopped waiting idle standby working clean calibrated present absent connected disconnected auto manual curve off on bulk absorption float equalization storage h264 h265 h.264 h.265 mjpeg snapshot netmon victron api led cleanup camera rknn detector recorder fan media relay rtsp http tailscaled rkipc'.split(' '))
const token = (value: unknown): string | undefined => typeof value === 'string' && PUBLIC_TOKENS.has(value.toLowerCase()) ? value : undefined
const size = (value: unknown): string | undefined => typeof value === 'string' && /^\d{2,5}x\d{2,5}$/.test(value) ? value : undefined

function fields(value: unknown, numbers: string[], booleans: string[] = [], tokens: string[] = []): RecordValue {
  const input = object(value)
  return Object.fromEntries([
    ...numbers.map((key) => [key, number(input[key])]),
    ...booleans.map((key) => [key, boolean(input[key])]),
    ...tokens.map((key) => [key, token(input[key])]),
  ].filter(([, value]) => value !== undefined))
}

export function publicFreshness(input: unknown, now = Date.now(), maxAge = 45) {
  const root = object(input)
  const relay = object(root.relay)
  const existing = object(root.telemetry)
  const timestamp = number(root.timestamp)
  const observed = number(existing.observed_at) ?? (timestamp !== undefined ? timestamp * 1000 : undefined)
  const rawAges = [root.age_seconds, existing.age_seconds, relay.cache_age_s]
  const reportedAges = rawAges.map(number).filter((value): value is number => value !== undefined)
  const reportedAge = reportedAges.length ? Math.max(...reportedAges) : undefined
  const validObserved = observed !== undefined && observed > 0 && observed <= now + 5000
  const age = validObserved ? Math.max(0, (now - observed) / 1000, reportedAge ?? 0) : observed === undefined && reportedAge !== undefined && reportedAge >= 0 ? reportedAge : null
  const invalid = rawAges.some((value) => value != null && number(value) === undefined) || [root.timestamp, existing.observed_at].some((value) => value != null && number(value) === undefined)
  const stale = invalid || root.stale === true || root.live === false || relay.stale === true || relay.upstream_stale === true || existing.stale === true || reportedAges.some((age) => age < 0) || age === null || age > maxAge
  return { observed_at: age === null ? null : now - age * 1000, received_at: now, age_seconds: age, stale }
}

export function publicHealth(input: unknown, now = Date.now()) {
  const root = object(input)
  if (typeof root.ok !== 'boolean' || root.error) return null
  const sys = object(root.system)
  const media = object(sys.media_graph)
  const detector = object(sys.rknn_detector)
  const services = Array.isArray(root.services) ? root.services.slice(0, 32).map((item) => {
    const service = object(item)
    return { name: token(service.name ?? service.Name) ?? 'service', ...fields(service, [], ['ok', 'OK'], ['status']) }
  }) : []
  return {
    ok: root.ok,
    uptime_s: Number.isInteger(root.uptime_s) && Number(root.uptime_s) >= 0 ? Number(root.uptime_s) : undefined,
    service_count: Number.isInteger(root.service_count) && Number(root.service_count) >= 0 && Number(root.service_count) <= 1000 ? Number(root.service_count) : undefined,
    services,
    services_down: Array.isArray(root.services_down) ? root.services_down.slice(0, 32).map((name) => token(name) ?? 'service') : undefined,
    telemetry: publicFreshness(root, now),
    system: {
      ...fields(sys, ['cpu_temp_c', 'victron_advert_age_s', 'tailscale_kicks_4h'], ['victron_hearing']),
      loadavg: fields(sys.loadavg, ['1m', '5m', '15m']),
      mem: fields(sys.mem, ['free_kb', 'avail_kb', 'total_kb', 'cma_free_kb', 'cma_total_kb']),
      performance: fields(sys.performance, ['cma_allocated_pct', 'swap_used_pct'], ['degraded'], ['status']),
      tailnet: fields(sys.tailnet, [], ['ok', 'tailnet_route_ok'], ['state']),
      media_graph: {
        ...fields(media, [], ['working'], ['state', 'visual_quality']),
        input_size: size(media.input_size), output_size: size(media.output_size),
        stream_profile: { ...fields(media.stream_profile, ['width', 'height', 'fps', 'bitrate_kbps', 'bitrate_mbps'], [], ['codec']), output_size: size(object(media.stream_profile).output_size) },
      },
      argon_fan: fields(sys.argon_fan,
        ['speed', 'auto_speed', 'manual_speed', 'rpm_estimate', 'estimated_rpm', 'max_rpm', 'override_remaining_s', 'override_expires_at', 'age_s'],
        ['available', 'ok', 'stale', 'rpm_estimated', 'override_active'], ['state', 'mode']),
      rknn_detector: {
        ...fields(detector, ['detections', 'actual_fps', 'target_fps', 'duration_ms', 'age_s', 'interval_sec'], ['available', 'ok', 'stale'], ['state', 'status']),
        waiting_for_stream: typeof detector.message === 'string' && detector.message.toLowerCase().includes('relay stream'),
      },
    },
  }
}

export function publicSolar(input: unknown, now = Date.now()) {
  const root = object(input)
  const freshness = publicFreshness(root, now, 90)
  if (number(root.timestamp) === undefined) { freshness.stale = true; freshness.observed_at = null; freshness.age_seconds = null }
  return {
    ...fields(root, ['battery_voltage', 'battery_soc', 'charging_current', 'solar_power', 'yield_today', 'load_current', 'timestamp'], ['load_on'], ['charge_state']),
    battery_soc_estimated: root.battery_soc_estimated !== false,
    age_seconds: freshness.age_seconds,
    live: !freshness.stale && number(root.battery_voltage) !== undefined && !root.error,
    stale: freshness.stale,
    telemetry: freshness,
    ...(root.error ? { error: 'telemetry_unavailable' } : {}),
  }
}

export function publicSolarHistory(input: unknown, now = Date.now()) {
  const root = object(input)
  const list = Array.isArray(input) ? input : [root.points, root.history, root.data, root.buckets].find(Array.isArray) ?? []
  return {
    points: (list as unknown[]).slice(0, 10000).map((item) => {
      const point = object(item)
      return {
        timestamp: number(point.timestamp ?? point.ts ?? point.time),
        battery_voltage: number(point.battery_voltage ?? point.batteryVoltage ?? point.battery_v),
        solar_power: number(point.solar_power ?? point.solarPower ?? point.pv_power_w ?? point.pvPowerW),
      }
    }).filter((point) => point.timestamp !== undefined && point.timestamp > 0 && point.timestamp * 1000 <= now + 5000 && point.battery_voltage !== undefined && point.solar_power !== undefined),
    telemetry: publicFreshness(root, now, 600),
  }
}
