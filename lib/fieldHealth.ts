export const FIELD_HEALTH_QUERY_KEY = ['field-health'] as const

export type ServiceLoose = {
  name?: string
  Name?: string
  status?: string
  OK?: boolean
  ok?: boolean
  detail?: string
}

export type SystemLoose = {
  loadavg?: { '1m'?: number; '5m'?: number; '15m'?: number }
  mem?: {
    free_kb?: number
    avail_kb?: number
    cma_free_kb?: number
    cma_total_kb?: number
    total_kb?: number
  }
  cpu_temp_c?: number
  performance?: {
    cma_allocated_pct?: number
    swap_used_pct?: number
    status?: string
  }
  media_graph?: {
    state?: string
    working?: boolean
    visual_quality?: string
    input_size?: string
    output_size?: string
  }
  tailnet?: {
    ok?: boolean
    state?: string
    tailnet_route_ok?: boolean
  }
  argon_fan?: {
    available?: boolean
    ok?: boolean
    state?: string
    stale?: boolean
    speed?: number
    auto_speed?: number
    manual_speed?: number
    rpm_estimate?: number
    estimated_rpm?: number
    max_rpm?: number
    rpm_estimated?: boolean
    mode?: string
    override_active?: boolean
    override_remaining_s?: number
    override_expires_at?: number
    age_s?: number
  }
  rknn_detector?: {
    available?: boolean
    ok?: boolean
    state?: string
    status?: string
    stale?: boolean
    detections?: number
    actual_fps?: number
    target_fps?: number
    duration_ms?: number
    age_s?: number
    interval_sec?: number
    message?: string
  }
  victron_advert_age_s?: number
  victron_hearing?: boolean
  tailscale_kicks_4h?: number
}

export type HealthLoose = {
  ok?: boolean
  error?: string
  uptime_s?: number
  service_count?: number
  services?: ServiceLoose[]
  services_down?: string[] | null
  system?: SystemLoose
}

export type HealthDigest = {
  ok: boolean
  uptimeSec: number
  servicesUp: number
  servicesTotal: number
  servicesDown: string[]
  rttMs: number
  fetchedAt: number
  system?: SystemLoose
}

export type HealthPollResult = {
  digest: HealthDigest | null
}

export function buildHealthDigest(
  parsed: HealthLoose,
  rttMs: number,
  fetchedAt = Date.now(),
): HealthDigest {
  const services = parsed.services ?? []
  const total = parsed.service_count ?? services.length
  const downList = parsed.services_down ?? services.reduce<string[]>((acc, s) => {
    const down = typeof s.OK === 'boolean'
      ? !s.OK
      : typeof s.ok === 'boolean'
        ? !s.ok
        : typeof s.status === 'string'
          ? s.status !== 'running'
          : false
    if (down) acc.push(s.name ?? s.Name ?? '?')
    return acc
  }, [])
  const down = downList?.length ?? 0
  const up = Math.max(0, total - down)

  return {
    ok: parsed.ok ?? (down === 0),
    uptimeSec: parsed.uptime_s ?? 0,
    servicesUp: up,
    servicesTotal: total,
    servicesDown: downList ?? [],
    rttMs,
    fetchedAt,
    system: parsed.system,
  }
}

export function healthLooksLive(parsed: HealthLoose | null): boolean {
  return Boolean(parsed && parsed.ok !== false && !parsed.error)
}
