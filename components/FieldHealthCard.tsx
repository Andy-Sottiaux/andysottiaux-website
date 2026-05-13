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

import { useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const HEALTH_URL = '/api/v3/health'

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
    rpm_estimate?: number
    estimated_rpm?: number
    max_rpm?: number
    rpm_estimated?: boolean
    mode?: string
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

function CompactChip({
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
    <div className="min-w-0">
      <div className="text-[7px] uppercase tracking-[0.16em]" style={{ color: muted }}>
        {label}
      </div>
      <div className="truncate" style={{ color }}>
        {value}
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
  const rknnFps = typeof rknn?.actual_fps === 'number' && Number.isFinite(rknn.actual_fps)
    ? rknn.actual_fps
    : typeof rknn?.target_fps === 'number' && Number.isFinite(rknn.target_fps)
      ? rknn.target_fps
      : null
  const rknnText = rknn?.available === false
    ? 'off'
    : rknnOk
      ? `${rknnFps != null ? rknnFps.toFixed(rknnFps >= 10 ? 0 : 1) : '1.0'} FPS`
      : rknn?.state || 'check'
  const rknnColor = rknnOk ? valueColor : palette.mutedText
  const thermalPct = typeof sys?.cpu_temp_c === 'number'
    ? Math.max(0, Math.min(100, ((sys.cpu_temp_c - 35) / 45) * 100))
    : 0

  if (compact) {
    return (
      <div
        className="relative rounded-2xl h-full min-h-0 flex flex-col overflow-hidden px-5 py-4 md:px-[clamp(1rem,1.7vw,1.35rem)] md:py-[clamp(0.8rem,1.55dvh,1.05rem)]"
        style={{
          background: palette.cardBackground,
          border: palette.cardBorder,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
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

        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <div
            className="min-w-0 rounded-xl border px-3 py-2.5 md:px-[clamp(0.6rem,1vw,0.85rem)] md:py-[clamp(0.45rem,0.95dvh,0.65rem)]"
            style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.025)' }}
          >
            <div className="text-[7.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: palette.mutedText }}>
              Thermal
            </div>
            <div className="mt-1 text-[25px] md:text-[clamp(19px,2.75dvh,25px)] font-semibold tracking-tight tabular-nums leading-none" style={{ color: thermalColor }}>
              {thermalLabel}
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
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
            className="min-w-0 rounded-xl border px-3 py-2.5 md:px-[clamp(0.6rem,1vw,0.85rem)] md:py-[clamp(0.45rem,0.95dvh,0.65rem)]"
            style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.025)' }}
          >
            <div className="text-[7.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: palette.mutedText }}>
              Fan
            </div>
            <div className="mt-1 text-[19px] md:text-[clamp(15px,2.0dvh,19px)] font-semibold tracking-tight tabular-nums leading-none truncate" style={{ color: fanColor }}>
              {fanRpm != null ? `${fanRpm.toLocaleString()} RPM` : fanText}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
                <div className="h-full rounded-full" style={{ width: `${fanPct ?? 0}%`, background: 'linear-gradient(90deg, #67e8f9, #30d158)' }} />
              </div>
              <div className="text-[10px] font-semibold tabular-nums" style={{ color: palette.mutedText }}>
                {fanPct != null ? `${fanPct}%` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div
          className="relative mt-2 rounded-xl border px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5 min-w-0"
          style={{ borderColor: palette.hairline, background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="min-w-0">
            <div className="text-[7px] uppercase tracking-[0.16em] font-semibold" style={{ color: palette.mutedText }}>
              Camera
            </div>
            <div className="mt-0.5 text-[13px] md:text-[clamp(10.5px,1.35dvh,13px)] font-semibold tracking-tight truncate" style={{ color: valueColor }}>
              {cameraLabel}
            </div>
            <div className="mt-0.5 text-[8.5px] font-semibold tabular-nums truncate" style={{ color: palette.fadedText }}>
              {sys?.media_graph?.output_size || '1280x720'}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[7px] uppercase tracking-[0.16em] font-semibold" style={{ color: palette.mutedText }}>
              RKNN
            </div>
            <div className="mt-0.5 text-[13px] md:text-[clamp(10.5px,1.35dvh,13px)] font-semibold tracking-tight truncate" style={{ color: rknnColor }}>
              {rknnText}
            </div>
            <div className="mt-0.5 text-[8.5px] font-semibold tabular-nums truncate" style={{ color: palette.fadedText }}>
              {typeof rknn?.duration_ms === 'number' ? `${Math.round(rknn.duration_ms)} ms` : `${rknn?.detections ?? 0} objects`}
            </div>
          </div>
        </div>

        <div
          className="relative mt-auto pt-2 border-t grid grid-cols-5 gap-x-2 text-[8.8px] md:text-[clamp(7px,0.82dvh,8.8px)] font-semibold tabular-nums min-w-0"
          style={{
            borderColor: palette.hairline,
          }}
        >
          <CompactChip label="Svc" value={digest ? `${digest.servicesUp}/${digest.servicesTotal}` : (lastOk ? `${lastOk.servicesUp}/${lastOk.servicesTotal}` : '—')} color={valueColor} muted={palette.fadedText} />
          <CompactChip label="Up" value={uptimeText} color={valueColor} muted={palette.fadedText} />
          <CompactChip label="RAM" value={ramAvailMB != null ? `${ramAvailMB}M` : '—'} color={ramColor} muted={palette.fadedText} />
          <CompactChip label="CMA" value={cmaPct != null ? `${cmaPct}%` : '—'} color={cmaColor} muted={palette.fadedText} />
          <CompactChip label="Net" value={tailnetText} color={tailnetColor} muted={palette.fadedText} />
        </div>

        <style jsx global>{`
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
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
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
        @keyframes fldHealthPing {
          0%   { transform: scale(1);   opacity: 0.55; }
          80%  { transform: scale(2.4); opacity: 0;    }
          100% { transform: scale(2.4); opacity: 0;    }
        }
      `}</style>
    </div>
  )
}
