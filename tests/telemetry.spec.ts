import { expect, test } from '@playwright/test'
import { publicFreshness, publicHealth, publicSolar, publicSolarHistory } from '../lib/publicTelemetry'
import { buildHealthDigest, healthLooksLive } from '../lib/fieldHealth'
import { readFieldTelemetry, resolveFieldUpstream } from '../lib/server/fieldTelemetry'
import { subscribeToPoll } from '../lib/useSharedPoll'

const now = 1788626400000

test('public health and SSR digest keep useful readings but strip topology and arbitrary data', () => {
  const body = publicHealth({ ok: true, uptime_s: 200, service_count: 1,
    secret: 'PRIVATE_MARKER', services: [{ name: 'camera', ok: true, detail: 'PRIVATE_MARKER' }],
    relay: { cache_age_s: 1, stale: false, source: 'PRIVATE_MARKER' },
    system: { private_key: 'PRIVATE_MARKER', cpu_temp_c: 47,
      media_graph: { working: true, output_size: '1280x960', private: 'PRIVATE_MARKER', stream_profile: { width: 1280, height: 960, fps: 30, codec: 'h264', private: 'PRIVATE_MARKER' } },
      tailnet: { ok: true, ip: '100.99.88.77' },
      argon_fan: { speed: 25, override_active: true, override_remaining_s: 90, path: 'PRIVATE_MARKER' },
      rknn_detector: { actual_fps: 0.45, target_fps: 0.65, message: 'waiting for relay stream at PRIVATE_MARKER' },
    },
  }, now)!
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE_MARKER|100\.99\.88\.77/)
  expect(body.system.media_graph.stream_profile).toMatchObject({ width: 1280, height: 960, fps: 30 })
  expect(body.system.rknn_detector).toMatchObject({ actual_fps: 0.45, target_fps: 0.65, waiting_for_stream: true })
  const digest = buildHealthDigest(body, 12, now)
  expect(JSON.stringify(digest)).not.toContain('PRIVATE_MARKER')
  expect(digest).toMatchObject({ ok: true, stale: false, observedAt: now - 1000, servicesUp: 1 })
})

test('empty, malformed, false and stale health never become a live success', () => {
  for (const value of [{}, [], 'ok', null, { ok: true, error: 'failed' }]) expect(publicHealth(value, now)).toBeNull()
  expect(healthLooksLive({})).toBe(false)
  expect(healthLooksLive({ ok: false })).toBe(false)
  expect(publicHealth({ ok: true }, now)?.telemetry.stale).toBe(true)
  expect(publicHealth({ ok: true, relay: { stale: true, cache_age_s: 0 } }, now)?.telemetry.stale).toBe(true)
  expect(publicHealth({ ok: true, uptime_s: -1, service_count: 2.5 }, now)).toMatchObject({ uptime_s: undefined, service_count: undefined })
})

test('freshness respects the oldest reported age and invalid clocks', () => {
  expect(publicFreshness({ timestamp: now / 1000, age_seconds: 0, relay: { cache_age_s: 3600 } }, now)).toMatchObject({ stale: true, age_seconds: 3600 })
  expect(publicFreshness({ age_seconds: 0, relay: { cache_age_s: -1 } }, now).stale).toBe(true)
  expect(publicFreshness({ age_seconds: NaN, relay: { cache_age_s: 0 } }, now).stale).toBe(true)
  for (const timestamp of [undefined, NaN, now / 1000 + 60, -1]) {
    expect(publicSolar({ battery_voltage: 13.4, timestamp, age_seconds: 0 }, now).live).toBe(false)
  }
  expect(publicFreshness({ relay: { cache_age_s: 4 } }, now)).toMatchObject({ stale: false, observed_at: now - 4000 })
})

test('solar preserves genuine zero and omits unknown values and private addresses', () => {
  const body = publicSolar({ battery_voltage: 13.4, solar_power: 0, timestamp: now / 1000, relay: { pi_base: 'PRIVATE_MARKER' }, model: 'PRIVATE_MARKER' }, now)
  expect(body).toMatchObject({ live: true, solar_power: 0, battery_soc_estimated: true })
  expect(body).not.toHaveProperty('load_current')
  expect(JSON.stringify(body)).not.toContain('PRIVATE_MARKER')
  const history = publicSolarHistory({ points: [{ timestamp: now / 1000, solar_power: 0, battery_voltage: 13.4, secret: 'PRIVATE_MARKER' }, { timestamp: now / 1000 }], relay: { pi_base: 'PRIVATE_MARKER' } }, now)
  expect(history.points).toHaveLength(1)
  expect(JSON.stringify(history)).not.toContain('PRIVATE_MARKER')
})

test('all server readers share normalized upstream precedence', () => {
  const env = { V3_UPSTREAM_HOST: ' https://relay.example/// ', V3_SOLAR_UPSTREAM_HOST: 'https://solar.example/', V3_SOLAR_HISTORY_UPSTREAM_HOST: 'https://history.example/' }
  expect(resolveFieldUpstream('health', env)).toBe('https://relay.example')
  expect(resolveFieldUpstream('solar', env)).toBe('https://solar.example')
  expect(resolveFieldUpstream('history', env)).toBe('https://history.example')
  expect(resolveFieldUpstream('health', { ...env, V3_HEALTH_UPSTREAM_HOST: 'https://health.example/' })).toBe('https://health.example')
  for (const value of ['file:///secret', 'https://user:secret@example.com', 'https://example.com/?secret=yes']) {
    expect(() => resolveFieldUpstream('health', { V3_HEALTH_UPSTREAM_HOST: value })).toThrow()
  }
})

test('server fetch failures are redacted and the deadline includes JSON reading', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('<html>PRIVATE_MARKER</html>', { status: 200 })
    expect(await readFieldTelemetry('health', '/api/health')).toEqual({ ok: false, status: 502, error: 'upstream_invalid_json' })
    globalThis.fetch = async () => new Response('PRIVATE_MARKER', { status: 500 })
    expect(await readFieldTelemetry('health', '/api/health')).toEqual({ ok: false, status: 502, error: 'upstream_status' })
    globalThis.fetch = async (_url, options) => ({ ok: true, json: () => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('PRIVATE_MARKER')), { once: true })) }) as Response
    expect(await readFieldTelemetry('health', '/api/health', 20)).toEqual({ ok: false, status: 504, error: 'upstream_timeout' })
  } finally { globalThis.fetch = original }
})

test('late aborted polls cannot stop an immediately remounted subscriber', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const documentMock = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock })
  const pending: Array<(value: number) => void> = []
  const values: number[] = []
  const poll = async () => new Promise<number>((resolve) => pending.push(resolve))
  let stop = () => undefined as void
  try {
    stop = subscribeToPoll('late-abort-test', poll, 30, undefined, value => values.push(value))
    await expect.poll(() => pending.length).toBe(1)
    stop()
    stop = subscribeToPoll('late-abort-test', poll, 30, undefined, value => values.push(value))
    await expect.poll(() => pending.length).toBe(2)
    pending[0](1)
    pending[1](2)
    await expect.poll(() => values).toEqual([2])
    await expect.poll(() => pending.length).toBe(3)
  } finally {
    stop()
    pending.forEach(resolve => resolve(0))
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
