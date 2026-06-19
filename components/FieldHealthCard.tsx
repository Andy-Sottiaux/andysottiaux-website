'use client'

/**
 * FieldHealthCard — board liveness, camera state, thermal, fan, memory, services.
 *
 * Polls a same-origin health proxy every 15s, measures wall-clock RTT
 * against the fetch (this is end-to-end, browser → proxy → device), and
 * degrades gracefully when the device is unreachable.
 *
 * Health JSON shape (varies slightly by version; we read both old/new keys):
 *   { ok, uptime_s, services: [{ name, status, ... }], services_down, ... }
 *
 * Theme: pulls chrome / typography colors from useFieldTheme(); the
 * online/offline accent (emerald/red) stays constant in both themes.
 */

import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const HEALTH_URL = '/api/v3/health'
const FAN_URL = '/api/v3/fan'
const FAN_OVERRIDE_TTL_SEC = 90

// Defensive: the upstream /api/health JSON shape has evolved. Accept a
// few field-name variants without exploding.
type ServiceLoose = {
  name?: string
  Name?: string
  status?: string
  OK?: boolean
  ok?: boolean
  detail?: string
}

type SystemLoose = {
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

type HealthLoose = {
  ok?: boolean
  uptime_s?: number
  service_count?: number
  services?: ServiceLoose[]
  services_down?: string[] | null
  system?: SystemLoose
}

type HealthDigest = {
  ok: boolean
  uptimeSec: number
  servicesUp: number
  servicesTotal: number
  servicesDown: string[]
  rttMs: number
  fetchedAt: number
  system?: SystemLoose
}

type HealthCardVariant = 'default' | 'compact'

function fmtUptime(s: number): string {
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

function fmtAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function CompactStatus({
  label,
  value,
  color,
  muted,
  border,
}: {
  label: string
  value: string
  color: string
  muted: string
  border: string
}) {
  return (
    <div
      className="min-w-0 rounded-xl border px-3 py-2"
      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}
    >
      <div className="text-[7.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: muted }}>
        {label}
      </div>
      <div className="mt-1 text-[14px] md:text-[clamp(11.5px,1.55dvh,14px)] font-semibold tracking-tight truncate" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function CompactStat({
  label,
  value,
  color,
  muted,
}: {
  label: string
  value: string
  color: string
  muted: string
}) {
  return (
    <div className="min-w-0 shrink">
      <span style={{ color: muted }}>
        {label}
      </span>{' '}
      <span className="normal-case tracking-normal" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

function FanControl({
  value,
  disabled,
  pending,
  status,
  compact,
  muted,
  valueColor,
  track,
  onChange,
  onCommit,
}: {
  value: number
  disabled: boolean
  pending: boolean
  status: string
  compact?: boolean
  muted: string
  valueColor: string
  track: string
  onChange: (value: number) => void
  onCommit: (value: number) => void
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const spinSec = Math.max(0.35, 1.6 - pct / 85)
  const lastCommitRef = useRef(0)
  const commitFromInput = (input: HTMLInputElement) => {
    const now = Date.now()
    if (now - lastCommitRef.current < 600) return
    lastCommitRef.current = now
    onCommit(Number(input.value))
  }

  return (
    <div
      className={compact ? 'mt-1 min-w-0' : 'mt-3 min-w-0'}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!compact && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[9px] uppercase tracking-[0.18em] font-semibold" style={{ color: muted }}>
            Fan override
          </div>
          <div className="text-[10px] font-semibold tabular-nums" style={{ color: pending ? valueColor : muted }}>
            {status}
          </div>
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="field-fan-rotor"
          style={{
            '--fan-spin': `${spinSec}s`,
            opacity: disabled ? 0.38 : 0.95,
          } as CSSProperties}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          disabled={disabled}
          aria-label="Fan speed override"
          title={`${pct}% · ${status}`}
          className="field-fan-range"
          style={{
            '--fan-pct': `${pct}%`,
            '--fan-track': track,
          } as CSSProperties}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
          onPointerUp={(e) => commitFromInput(e.currentTarget)}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(e.key)) {
              commitFromInput(e.currentTarget)
            }
          }}
          onBlur={(e) => commitFromInput(e.currentTarget)}
        />
        <span className="w-7 shrink-0 text-right text-[8.5px] font-semibold tabular-nums" style={{ color: compact ? muted : valueColor }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

export default function FieldHealthCard({
  variant = 'default',
}: {
  variant?: HealthCardVariant
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const compact = variant === 'compact'

  const [digest, setDigest] = useState<HealthDigest | null>(null)
  // Tri-state: 'connecting' until the first poll resolves, then 'online'
  // or 'offline'. Avoids a "broken-looking" Offline flash on first paint.
  const [phase, setPhase] = useState<'connecting' | 'resolved'>('connecting')
  const [, forceTick] = useState(0) // re-render every 30s for "X min ago"
  const [fanDraft, setFanDraft] = useState<number | null>(null)
  const [fanPending, setFanPending] = useState(false)
  const [fanError, setFanError] = useState<string | null>(null)
  const lastOkRef = useRef<HealthDigest | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const t0 = performance.now()
      let ok = false
      let parsed: HealthLoose | null = null
      try {
        const ctrl = new AbortController()
        const timeoutId = setTimeout(() => ctrl.abort(), 8000)
        const res = await fetch(HEALTH_URL, { signal: ctrl.signal, cache: 'no-store' })
        clearTimeout(timeoutId)
        if (res.ok) {
          parsed = (await res.json()) as HealthLoose
          ok = true
        }
      } catch {
        ok = false
      }
      const rttMs = Math.round(performance.now() - t0)
      if (cancelled) return

      // Mark phase resolved either way — we've heard back (success or
      // failure) at least once, so the UI can stop saying "Connecting".
      setPhase('resolved')

      if (ok && parsed && !('error' in (parsed as object))) {
        const services = parsed.services ?? []
        const total = parsed.service_count ?? services.length
        const downList = parsed.services_down ?? services.filter((s) => {
          if (typeof s.OK === 'boolean') return !s.OK
          if (typeof s.ok === 'boolean') return !s.ok
          if (typeof s.status === 'string') return s.status !== 'running'
          return false
        }).map((s) => s.name ?? s.Name ?? '?')
        const down = downList?.length ?? 0
        const up = Math.max(0, total - down)
        // The board considers "ok" = critical-subsystems fresh. Detector
        // and recorder being down is informational, not failure — but
        // we still surface count + names in the UI.
        const next: HealthDigest = {
          ok: parsed.ok ?? (down === 0),
          uptimeSec: parsed.uptime_s ?? 0,
          servicesUp: up,
          servicesTotal: total,
          servicesDown: downList ?? [],
          rttMs,
          fetchedAt: Date.now(),
          system: parsed.system,
        }
        setDigest(next)
        lastOkRef.current = next
      } else {
        setDigest(null)
      }
      timer = setTimeout(tick, 15_000)
    }

    tick()
    const ageTimer = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      clearInterval(ageTimer)
    }
  }, [])

  const connecting = phase === 'connecting'
  const online = digest != null && digest.ok
  const lastOk = lastOkRef.current
  // Degraded = critical-subsystems healthy but at least one informational
  // service is down (detector / recorder, etc.). UI shows green dot but
  // notes the names below.
  const degraded = digest != null && digest.ok && digest.servicesDown.length > 0
  const sys = digest?.system ?? lastOk?.system

  const onlineHeadline = palette.headlineGradient
  const offlineHeadline = isLight
    ? 'linear-gradient(180deg, #b2261d 0%, #6e6e73 100%)'
    : 'linear-gradient(180deg, #ffb0aa 0%, #6e6e73 100%)'
  const connectingHeadline = isLight
    ? 'linear-gradient(180deg, #1c1a1c 0%, #6e6e73 100%)'
    : 'linear-gradient(180deg, #f5f5f7 0%, #8e8e93 100%)'

  const headlineLabel = connecting ? 'Connecting' : online ? 'Online' : 'Offline'
  const headlineGradient = connecting
    ? connectingHeadline
    : online
      ? onlineHeadline
      : offlineHeadline
  const dotColor = connecting ? '#8e8e93' : online ? '#30d158' : '#ff453a'
  const dotGlow = connecting
    ? '0 0 6px rgba(142,142,147,0.45)'
    : online
      ? '0 0 12px rgba(48,209,88,0.6)'
      : '0 0 8px rgba(255,69,58,0.5)'

  const valueColor = isLight ? '#1c1a1c' : '#fff'
  const mediaWorking = sys?.media_graph?.working
  const mediaQuality = sys?.media_graph?.visual_quality
  const cameraLabel = mediaWorking
    ? mediaQuality === 'calibrated'
      ? 'Calibrated'
      : 'Working'
    : online
      ? 'Check'
      : '—'
  const thermalLabel = typeof sys?.cpu_temp_c === 'number' && sys.cpu_temp_c > 0
    ? `${Math.round(sys.cpu_temp_c)}°C`
    : '—'
  const thermalColor = typeof sys?.cpu_temp_c === 'number' && sys.cpu_temp_c >= 70
    ? (isLight ? '#b45309' : '#fcd34d')
    : valueColor
  const ramAvailMB = typeof sys?.mem?.avail_kb === 'number'
    ? Math.max(0, Math.round(sys.mem.avail_kb / 1024))
    : null
  const ramColor = ramAvailMB != null && ramAvailMB < 32
    ? (isLight ? '#b45309' : '#fcd34d')
    : valueColor
  const fan = sys?.argon_fan
  const fanPct = typeof fan?.speed === 'number' && Number.isFinite(fan.speed)
    ? Math.max(0, Math.min(100, Math.round(fan.speed)))
    : null
  const fanMaxRpm = typeof fan?.max_rpm === 'number' && Number.isFinite(fan.max_rpm) && fan.max_rpm > 0
    ? fan.max_rpm
    : 5000
  const fanRpmRaw = typeof fan?.rpm_estimate === 'number' && Number.isFinite(fan.rpm_estimate)
    ? fan.rpm_estimate
    : typeof fan?.estimated_rpm === 'number' && Number.isFinite(fan.estimated_rpm)
      ? fan.estimated_rpm
      : fanPct != null
        ? (fanPct * fanMaxRpm) / 100
        : null
  const fanRpm = fanRpmRaw != null
    ? Math.max(0, Math.round(fanRpmRaw))
    : null
  const fanStale = fan?.stale === true || fan?.state === 'stale'
  const fanText = fanPct != null && fanRpm != null
    ? `${fanRpm.toLocaleString()} RPM / ${fanPct}%`
    : fan?.available === false
      ? '—'
      : fan?.state || '—'
  const fanColor = fanStale || fan?.state === 'error'
    ? palette.mutedText
    : valueColor
  const fanOverrideRemaining = typeof fan?.override_remaining_s === 'number'
    ? Math.max(0, Math.ceil(fan.override_remaining_s))
    : typeof fan?.override_expires_at === 'number'
      ? Math.max(0, Math.ceil(fan.override_expires_at - Date.now() / 1000))
      : null
  const fanSliderValue = fanDraft ?? fanPct ?? 0
  const fanControlDisabled = !online || fan?.available === false || fanStale || fanPending
  const fanControlStatus = fanPending
    ? 'Setting'
    : fan?.override_active
      ? `Auto ${fanOverrideRemaining ?? FAN_OVERRIDE_TTL_SEC}s`
      : fanError ?? 'Auto'
  const uptimeText = digest
    ? fmtUptime(digest.uptimeSec)
    : (lastOk ? fmtUptime(lastOk.uptimeSec) : '—')
  const checkedText = digest ? 'now' : (lastOk ? fmtAge(Date.now() - lastOk.fetchedAt) : '—')
  const tailnetText = typeof sys?.tailscale_kicks_4h === 'number' && sys.tailscale_kicks_4h > 0
    ? `${sys.tailscale_kicks_4h} kicks`
    : sys?.tailnet?.ok === true
      ? 'ok'
      : sys?.tailnet?.state || '—'
  const tailnetColor = typeof sys?.tailscale_kicks_4h === 'number' && sys.tailscale_kicks_4h > 0
    ? (isLight ? '#b45309' : '#fcd34d')
    : sys?.tailnet?.ok === true
      ? valueColor
      : palette.mutedText
  const cmaPct = typeof sys?.performance?.cma_allocated_pct === 'number'
    ? Math.round(sys.performance.cma_allocated_pct)
    : typeof sys?.mem?.cma_total_kb === 'number' && sys.mem.cma_total_kb > 0 && typeof sys.mem.cma_free_kb === 'number'
      ? Math.round(((sys.mem.cma_total_kb - sys.mem.cma_free_kb) / sys.mem.cma_total_kb) * 100)
      : null
  const cmaText = cmaPct != null ? `CMA ${cmaPct}%` : checkedText
  const cmaColor = cmaPct != null && cmaPct >= 80
    ? (isLight ? '#b45309' : '#fcd34d')
    : valueColor
  const rknn = sys?.rknn_detector
  const rknnOk = rknn?.ok === true || rknn?.state === 'ok' || rknn?.status === 'ok'
  const rknnWaitingForRelay = (
    rknn?.state === 'starting' ||
    rknn?.status === 'starting'
  ) && typeof rknn?.message === 'string' && rknn.message.toLowerCase().includes('relay stream')
  const rknnWaiting = rknnWaitingForRelay || (
    (rknn?.state === 'starting' || rknn?.status === 'starting') &&
    rknn?.ok !== true &&
    typeof rknn?.actual_fps === 'number' &&
    rknn.actual_fps <= 0
  )
  const rknnFps = typeof rknn?.actual_fps === 'number' && Number.isFinite(rknn.actual_fps)
    ? rknn.actual_fps
    : typeof rknn?.target_fps === 'number' && Number.isFinite(rknn.target_fps)
      ? rknn.target_fps
      : null
  const rknnText = rknn?.available === false
    ? 'off'
    : rknnWaiting
      ? 'waiting'
      : rknn?.stale === true
        ? 'stale'
        : rknnOk
          ? `${rknnFps != null ? rknnFps.toFixed(rknnFps >= 10 ? 0 : 1) : '1.0'} FPS`
          : rknn?.state || 'check'
  const rknnDetail = rknnWaitingForRelay
    ? 'relay stream'
    : typeof rknn?.duration_ms === 'number'
      ? `${Math.round(rknn.duration_ms)} ms`
      : typeof rknn?.interval_sec === 'number' && rknn.interval_sec > 0
        ? `${Math.round(rknn.interval_sec)}s interval`
        : `${rknn?.detections ?? 0} objects`
  const rknnColor = rknnOk
    ? valueColor
    : rknnWaiting
      ? (isLight ? '#b45309' : '#fcd34d')
      : palette.mutedText
  const thermalPct = typeof sys?.cpu_temp_c === 'number'
    ? Math.max(0, Math.min(100, ((sys.cpu_temp_c - 35) / 45) * 100))
    : 0

  useEffect(() => {
    if (!fanPending && fanPct != null) {
      setFanDraft(fanPct)
    }
  }, [fanPct, fanPending])

  const commitFanSpeed = async (rawSpeed: number) => {
    const speed = Math.max(0, Math.min(100, Math.round(rawSpeed)))
    setFanDraft(speed)
    if (fanControlDisabled && !fanPending) return

    setFanPending(true)
    setFanError(null)
    try {
      const res = await fetch(FAN_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed, ttl_sec: FAN_OVERRIDE_TTL_SEC }),
      })
      const data = await res.json().catch(() => null) as { ok?: boolean; fan?: SystemLoose['argon_fan']; error?: string } | null
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'fan_command_failed')
      }
      if (data?.fan) {
        setDigest((prev) => prev
          ? {
              ...prev,
              system: {
                ...(prev.system ?? {}),
                argon_fan: data.fan,
              },
            }
          : prev)
      }
    } catch {
      setFanError('Retry')
    } finally {
      setFanPending(false)
    }
  }

  if (compact) {
    return (
      <div
        className="relative rounded-2xl h-full min-h-0 flex flex-col overflow-hidden px-4 py-3 md:px-[clamp(0.75rem,1.25vw,1rem)] md:py-[clamp(0.55rem,1.05dvh,0.75rem)]"
        data-field-card="true"
        style={{
          background: palette.cardBackground,
          border: palette.cardBorder,
          backdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
          WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
          boxShadow: palette.cardShadow,
        }}
        role="region"
        aria-label="System health"
      >
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full"
          style={{
            background: connecting
              ? `radial-gradient(circle, rgba(142,142,147,${isLight ? 0.08 : 0.12}), transparent 70%)`
              : online
                ? `radial-gradient(circle, rgba(48,209,88,${isLight ? 0.12 : 0.18}), transparent 70%)`
                : `radial-gradient(circle, rgba(255,69,58,${isLight ? 0.08 : 0.12}), transparent 70%)`,
          }}
        />

        <div className="relative flex items-center justify-between gap-3">
          <div
            className="text-[10px] md:text-[clamp(8.5px,1.1dvh,10px)] font-semibold uppercase tracking-[0.22em]"
            style={{ color: isLight ? '#0f9d4f' : 'rgba(74, 222, 128, 0.9)' }}
          >
            Health
          </div>
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] md:text-[clamp(7.5px,0.9dvh,9px)] font-bold uppercase tracking-[0.18em]"
            style={{
              color: online ? (isLight ? '#0f9d4f' : '#86efac') : connecting ? palette.mutedText : '#ff8a80',
              background: online
                ? (isLight ? 'rgba(15,157,79,0.08)' : 'rgba(134,239,172,0.10)')
                : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
              border: palette.cardBorder,
            }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor, boxShadow: dotGlow }} />
            {headlineLabel}
          </div>
        </div>

        {degraded && digest && (
          <div
            className="relative mt-2 text-[10px] md:text-[clamp(8.5px,1dvh,10px)] truncate"
            style={{ color: isLight ? '#b45309' : '#fcd34d' }}
          >
            {digest.servicesDown.join(', ')}
          </div>
        )}

        <div className="relative mt-1.5 grid grid-cols-2 gap-1.5 md:gap-[clamp(0.3rem,0.75dvh,0.45rem)] min-h-0">
          <div
            className="min-w-0 rounded-xl border px-2.5 py-1.5 md:px-[clamp(0.5rem,0.9vw,0.7rem)] md:py-[clamp(0.3rem,0.65dvh,0.45rem)]"
            style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.025)' }}
          >
            <div className="text-[7.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: palette.mutedText }}>
              Thermal
            </div>
            <div className="mt-1 text-[20px] md:text-[clamp(15px,2dvh,20px)] font-semibold tracking-tight tabular-nums leading-none" style={{ color: thermalColor }}>
              {thermalLabel}
            </div>
            <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${thermalPct}%`,
                  background: typeof sys?.cpu_temp_c === 'number' && sys.cpu_temp_c >= 70
                    ? 'linear-gradient(90deg, #ff9f0a, #ff453a)'
                    : 'linear-gradient(90deg, #30d158, #67e8f9)',
                }}
              />
            </div>
          </div>
          <div
            className="min-w-0 rounded-xl border px-2.5 py-1.5 md:px-[clamp(0.5rem,0.9vw,0.7rem)] md:py-[clamp(0.3rem,0.65dvh,0.45rem)]"
            style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.025)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[7.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: palette.mutedText }}>
                Fan
              </div>
              <div className="text-[7.5px] font-semibold tabular-nums truncate" style={{ color: palette.fadedText }}>
                {fanControlStatus}
              </div>
            </div>
            <div className="mt-1 text-[15px] md:text-[clamp(11.5px,1.55dvh,15px)] font-semibold tracking-tight tabular-nums leading-none truncate" style={{ color: fanColor }}>
              {fanRpm != null ? `${fanRpm.toLocaleString()} RPM` : fanText}
            </div>
            <FanControl
              compact
              value={fanSliderValue}
              disabled={fanControlDisabled}
              pending={fanPending}
              status={fanControlStatus}
              muted={palette.mutedText}
              valueColor={valueColor}
              track={palette.trackBackground}
              onChange={setFanDraft}
              onCommit={commitFanSpeed}
            />
          </div>
          <div
            className="min-w-0 rounded-xl border px-2.5 py-1.5 md:px-[clamp(0.5rem,0.9vw,0.7rem)] md:py-[clamp(0.3rem,0.65dvh,0.45rem)]"
            style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="text-[7px] uppercase tracking-[0.16em] font-semibold" style={{ color: palette.mutedText }}>
              Camera
            </div>
            <div className="mt-0.5 text-[12px] md:text-[clamp(9.5px,1.18dvh,12px)] font-semibold tracking-tight truncate" style={{ color: valueColor }}>
              {cameraLabel}
            </div>
            <div className="mt-0.5 text-[7.5px] font-semibold tabular-nums truncate" style={{ color: palette.fadedText }}>
              {sys?.media_graph?.output_size || '1280x720'}
            </div>
          </div>
          <div
            className="min-w-0 rounded-xl border px-2.5 py-1.5 md:px-[clamp(0.5rem,0.9vw,0.7rem)] md:py-[clamp(0.3rem,0.65dvh,0.45rem)]"
            style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="text-[7px] uppercase tracking-[0.16em] font-semibold" style={{ color: palette.mutedText }}>
              RKNN
            </div>
            <div className="mt-0.5 text-[12px] md:text-[clamp(9.5px,1.18dvh,12px)] font-semibold tracking-tight truncate" style={{ color: rknnColor }}>
              {rknnText}
            </div>
            <div className="mt-0.5 text-[7.5px] font-semibold tabular-nums truncate" style={{ color: palette.fadedText }}>
              {rknnDetail}
            </div>
          </div>
        </div>

        <div
          className="relative mt-auto pt-1.5 border-t flex items-center justify-between gap-1.5 text-[7px] md:text-[clamp(5.8px,0.66dvh,7px)] font-semibold uppercase tracking-[0.05em] tabular-nums min-w-0 whitespace-nowrap"
          style={{
            borderColor: palette.hairline,
          }}
        >
          <CompactStat label="Svc" value={digest ? `${digest.servicesUp}/${digest.servicesTotal}` : (lastOk ? `${lastOk.servicesUp}/${lastOk.servicesTotal}` : '—')} color={valueColor} muted={palette.fadedText} />
          <CompactStat label="Up" value={uptimeText} color={valueColor} muted={palette.fadedText} />
          <CompactStat label="RAM" value={ramAvailMB != null ? `${ramAvailMB}M` : '—'} color={ramColor} muted={palette.fadedText} />
          <CompactStat label="CMA" value={cmaPct != null ? `${cmaPct}%` : '—'} color={cmaColor} muted={palette.fadedText} />
          <CompactStat label="Net" value={tailnetText} color={tailnetColor} muted={palette.fadedText} />
        </div>

        <style jsx global>{`
          .field-fan-rotor {
            --fan-spin: 1s;
            width: 14px;
            height: 14px;
            flex: 0 0 auto;
            border-radius: 999px;
            background:
              radial-gradient(circle at center, rgba(255,255,255,0.95) 0 16%, transparent 17%),
              conic-gradient(from 25deg, #67e8f9 0 18%, transparent 18% 33%, #30d158 33% 51%, transparent 51% 66%, #67e8f9 66% 84%, transparent 84% 100%);
            filter: drop-shadow(0 0 5px rgba(103,232,249,0.42));
            animation: fldFanSpin var(--fan-spin) linear infinite;
          }
          .field-fan-range {
            --fan-pct: 0%;
            --fan-track: rgba(255,255,255,0.12);
            appearance: none;
            -webkit-appearance: none;
            width: 100%;
            min-width: 0;
            height: 14px;
            background: transparent;
            cursor: pointer;
          }
          .field-fan-range:disabled {
            cursor: not-allowed;
            opacity: 0.48;
          }
          .field-fan-range::-webkit-slider-runnable-track {
            height: 5px;
            border-radius: 999px;
            background: linear-gradient(90deg, #67e8f9 0 var(--fan-pct), var(--fan-track) var(--fan-pct) 100%);
          }
          .field-fan-range::-moz-range-track {
            height: 5px;
            border-radius: 999px;
            background: linear-gradient(90deg, #67e8f9 0 var(--fan-pct), var(--fan-track) var(--fan-pct) 100%);
          }
          .field-fan-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 13px;
            height: 13px;
            margin-top: -4px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.86);
            background: #30d158;
            box-shadow: 0 0 0 3px rgba(48,209,88,0.14), 0 0 10px rgba(103,232,249,0.38);
          }
          .field-fan-range::-moz-range-thumb {
            width: 13px;
            height: 13px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.86);
            background: #30d158;
            box-shadow: 0 0 0 3px rgba(48,209,88,0.14), 0 0 10px rgba(103,232,249,0.38);
          }
          @keyframes fldFanSpin {
            to { transform: rotate(360deg); }
          }
          @keyframes fldHealthPing {
            0%   { transform: scale(1);   opacity: 0.55; }
            80%  { transform: scale(2.4); opacity: 0;    }
            100% { transform: scale(2.4); opacity: 0;    }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div
      className={`relative rounded-2xl h-full min-h-0 flex flex-col overflow-hidden ${compact ? 'px-5 py-4 md:px-[clamp(1rem,1.7vw,1.5rem)] md:py-[clamp(0.8rem,1.75dvh,1.25rem)]' : 'p-7 md:p-8'}`}
      data-field-card="true"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        boxShadow: palette.cardShadow,
      }}
      role="region"
      aria-label="System health"
    >
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full"
        style={{
          background: connecting
            ? `radial-gradient(circle, rgba(142,142,147,${isLight ? 0.08 : 0.12}), transparent 70%)`
            : online
              ? `radial-gradient(circle, rgba(48,209,88,${isLight ? 0.12 : 0.18}), transparent 70%)`
              : `radial-gradient(circle, rgba(255,69,58,${isLight ? 0.08 : 0.12}), transparent 70%)`,
          transition: 'background 0.8s ease',
        }}
      />

      <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-3 md:mb-[clamp(0.4rem,1.1dvh,0.75rem)]' : 'mb-5'}`}>
        <div
          className={`${compact ? 'text-[10px] md:text-[clamp(8.5px,1.1dvh,10px)]' : 'text-[10.5px]'} font-semibold uppercase tracking-[0.22em]`}
          style={{ color: isLight ? '#0f9d4f' : 'rgba(74, 222, 128, 0.9)' }}
        >
          Health
        </div>
        {compact && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 md:py-[clamp(0.2rem,0.55dvh,0.25rem)] text-[9px] md:text-[clamp(7.5px,0.9dvh,9px)] font-bold uppercase tracking-[0.18em]"
            style={{
              color: online ? (isLight ? '#0f9d4f' : '#86efac') : connecting ? palette.mutedText : '#ff8a80',
              background: online
                ? (isLight ? 'rgba(15,157,79,0.08)' : 'rgba(134,239,172,0.10)')
                : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
              border: palette.cardBorder,
            }}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: dotColor, boxShadow: dotGlow }}
            />
            {headlineLabel}
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex items-center gap-3 mb-6">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span
              className="absolute inline-flex h-full w-full rounded-full"
              style={{
                background: dotColor,
                opacity: online ? 0.55 : connecting ? 0.5 : 0.4,
                animation: online || connecting
                  ? 'fldHealthPing 2.2s cubic-bezier(0,0,0.2,1) infinite'
                  : 'none',
              }}
            />
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{
                background: dotColor,
                boxShadow: dotGlow,
              }}
            />
          </span>
          <div
            className="text-[34px] sm:text-[40px] font-semibold leading-none tracking-tight"
            style={{
              // backgroundImage (longhand) — using `background:` shorthand
              // resets background-clip back to its default, leaving the
              // gradient painted as a solid block instead of clipping to
              // the glyphs (renders as a white rectangle on dark mode).
              backgroundImage: headlineGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {headlineLabel}
          </div>
        </div>
      )}

      {degraded && digest && (
        <div
          className={`${compact ? 'text-[10.5px] md:text-[clamp(9px,1.05dvh,10.5px)] mb-3 md:mb-[clamp(0.35rem,0.9dvh,0.75rem)] -mt-2 truncate' : 'text-[11px] mb-4 -mt-2'} tracking-tight`}
          style={{
            color: isLight ? '#b45309' : '#fcd34d',
            opacity: 0.9,
          }}
        >
          <span style={{ fontWeight: 600 }}>Degraded:</span>{' '}
          {digest.servicesDown.join(', ')}
        </div>
      )}

      <dl className={`grid grid-cols-2 min-h-0 ${compact ? 'mt-0 content-start gap-x-4 gap-y-2 md:gap-y-[clamp(0.3rem,0.85dvh,0.5rem)]' : 'mt-auto gap-x-6 gap-y-4'}`}>
        <div>
          <dt
            className={`${compact ? 'text-[8.5px] md:text-[clamp(7.5px,0.9dvh,8.5px)]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Thermal
          </dt>
          <dd
            className={`${compact ? 'text-[17px] md:text-[clamp(14px,2dvh,18px)]' : 'text-[20px] sm:text-[22px]'} font-semibold tracking-tight tabular-nums mt-1 md:mt-[clamp(0.15rem,0.55dvh,0.25rem)]`}
            style={{ color: thermalColor }}
          >
            {thermalLabel}
          </dd>
        </div>
        <div>
          <dt
            className={`${compact ? 'text-[8.5px] md:text-[clamp(7.5px,0.9dvh,8.5px)]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Fan
          </dt>
          <dd
            className={`${compact ? 'text-[14px] md:text-[clamp(12px,1.7dvh,15.5px)]' : 'text-[18px] sm:text-[20px]'} font-semibold tracking-tight tabular-nums mt-1 md:mt-[clamp(0.15rem,0.55dvh,0.25rem)] truncate`}
            style={{ color: fanColor }}
            title={fanPct != null ? `Estimated from ${fanPct}% of ${fanMaxRpm.toLocaleString()} RPM max` : undefined}
          >
            {fanText}
          </dd>
        </div>
        <div>
          <dt
            className={`${compact ? 'text-[8.5px] md:text-[clamp(7.5px,0.9dvh,8.5px)]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Camera
          </dt>
          <dd
            className={`${compact ? 'text-[17px] md:text-[clamp(14px,2dvh,18px)]' : 'text-[20px] sm:text-[22px]'} font-semibold tracking-tight mt-1 md:mt-[clamp(0.15rem,0.55dvh,0.25rem)] truncate`}
            style={{ color: valueColor }}
          >
            {cameraLabel}
          </dd>
        </div>
        <div>
          <dt
            className={`${compact ? 'text-[8.5px] md:text-[clamp(7.5px,0.9dvh,8.5px)]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            RAM
          </dt>
          <dd
            className={`${compact ? 'text-[17px] md:text-[clamp(14px,2dvh,18px)]' : 'text-[20px] sm:text-[22px]'} font-semibold tracking-tight tabular-nums mt-1 md:mt-[clamp(0.15rem,0.55dvh,0.25rem)]`}
            style={{ color: ramColor }}
          >
            {ramAvailMB != null ? `${ramAvailMB}M` : '—'}
          </dd>
        </div>
        {!compact && (
          <div>
            <dt
              className="text-[10px] uppercase tracking-[0.18em] font-medium"
              style={{ color: palette.mutedText }}
            >
              Services
            </dt>
            <dd
              className="text-[20px] sm:text-[22px] font-semibold tracking-tight tabular-nums mt-1 md:mt-[clamp(0.15rem,0.55dvh,0.25rem)]"
              style={{ color: valueColor }}
            >
              {digest
                ? `${digest.servicesUp}/${digest.servicesTotal}`
                : (lastOk ? `${lastOk.servicesUp}/${lastOk.servicesTotal}` : '—')}
            </dd>
          </div>
        )}
      </dl>

      {sys && !compact && (
        <div
          className="mt-5 rounded-xl border px-4 py-3"
          style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.025)' }}
        >
          <FanControl
            value={fanSliderValue}
            disabled={fanControlDisabled}
            pending={fanPending}
            status={fanControlStatus}
            muted={palette.mutedText}
            valueColor={valueColor}
            track={palette.trackBackground}
            onChange={setFanDraft}
            onCommit={commitFanSpeed}
          />
        </div>
      )}

      {sys && compact && (
        <div
          className="mt-auto pt-2 md:pt-[clamp(0.35rem,0.85dvh,0.5rem)] border-t grid gap-x-2 gap-y-1.5 text-[10.5px] md:text-[clamp(8px,0.95dvh,10px)] font-semibold tabular-nums min-w-0 flex-shrink-0"
          style={{
            borderColor: palette.hairline,
            color: palette.mutedText,
            gridTemplateColumns: 'repeat(auto-fit, minmax(4.1rem, 1fr))',
          }}
          aria-label={`Services ${digest ? `${digest.servicesUp}/${digest.servicesTotal}` : (lastOk ? `${lastOk.servicesUp}/${lastOk.servicesTotal}` : 'unknown')}, uptime ${uptimeText}, camera memory ${cmaText}, Tailnet ${tailnetText}`}
        >
          <div className="min-w-0">
            <div className="text-[7px] uppercase tracking-[0.16em]" style={{ color: palette.fadedText }}>Svc</div>
            <div className="truncate" style={{ color: valueColor }}>
              {digest
                ? `${digest.servicesUp}/${digest.servicesTotal}`
                : (lastOk ? `${lastOk.servicesUp}/${lastOk.servicesTotal}` : '—')}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[7px] uppercase tracking-[0.16em]" style={{ color: palette.fadedText }}>Up</div>
            <div className="truncate" style={{ color: valueColor }}>{uptimeText}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[7px] uppercase tracking-[0.16em]" style={{ color: palette.fadedText }}>Mem</div>
            <div className="truncate" style={{ color: cmaColor }}>{cmaText}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[7px] uppercase tracking-[0.16em]" style={{ color: palette.fadedText }}>Net</div>
            <div className="truncate" style={{ color: tailnetColor }}>{tailnetText}</div>
          </div>
        </div>
      )}

      {sys && !compact && (
        <div
          className="mt-4 pt-3 border-t grid grid-cols-3 gap-3 tabular-nums"
          style={{
            borderColor: palette.hairline,
          }}
        >
          <div className="min-w-0">
            <div
              className="text-[8px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: palette.mutedText }}
            >
              Uptime
            </div>
            <div
              className={`${compact ? 'text-[11px]' : 'text-[12px]'} mt-1 truncate font-semibold`}
              style={{ color: valueColor }}
            >
              {uptimeText}
            </div>
          </div>
          <div className="min-w-0">
            <div
              className="text-[8px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: palette.mutedText }}
            >
              Checked
            </div>
            <div
              className={`${compact ? 'text-[11px]' : 'text-[12px]'} mt-1 truncate font-semibold`}
              style={{ color: valueColor }}
            >
              {checkedText}
            </div>
          </div>
          <div className="min-w-0">
            <div
              className="text-[8px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: palette.mutedText }}
            >
              Tailnet
            </div>
            <div
              className={`${compact ? 'text-[11px]' : 'text-[12px]'} mt-1 truncate font-semibold`}
              style={{ color: tailnetColor }}
            >
              {tailnetText}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .field-fan-rotor {
          --fan-spin: 1s;
          width: 14px;
          height: 14px;
          flex: 0 0 auto;
          border-radius: 999px;
          background:
            radial-gradient(circle at center, rgba(255,255,255,0.95) 0 16%, transparent 17%),
            conic-gradient(from 25deg, #67e8f9 0 18%, transparent 18% 33%, #30d158 33% 51%, transparent 51% 66%, #67e8f9 66% 84%, transparent 84% 100%);
          filter: drop-shadow(0 0 5px rgba(103,232,249,0.42));
          animation: fldFanSpin var(--fan-spin) linear infinite;
        }
        .field-fan-range {
          --fan-pct: 0%;
          --fan-track: rgba(255,255,255,0.12);
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          min-width: 0;
          height: 14px;
          background: transparent;
          cursor: pointer;
        }
        .field-fan-range:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }
        .field-fan-range::-webkit-slider-runnable-track {
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, #67e8f9 0 var(--fan-pct), var(--fan-track) var(--fan-pct) 100%);
        }
        .field-fan-range::-moz-range-track {
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, #67e8f9 0 var(--fan-pct), var(--fan-track) var(--fan-pct) 100%);
        }
        .field-fan-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 13px;
          height: 13px;
          margin-top: -4px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.86);
          background: #30d158;
          box-shadow: 0 0 0 3px rgba(48,209,88,0.14), 0 0 10px rgba(103,232,249,0.38);
        }
        .field-fan-range::-moz-range-thumb {
          width: 13px;
          height: 13px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.86);
          background: #30d158;
          box-shadow: 0 0 0 3px rgba(48,209,88,0.14), 0 0 10px rgba(103,232,249,0.38);
        }
        @keyframes fldFanSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes fldHealthPing {
          0%   { transform: scale(1);   opacity: 0.55; }
          80%  { transform: scale(2.4); opacity: 0;    }
          100% { transform: scale(2.4); opacity: 0;    }
        }
      `}</style>
    </div>
  )
}
