'use client'

/**
 * FieldHealthCard — board liveness, uptime, services, latency.
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
  mem?: { free_kb?: number; avail_kb?: number; cma_free_kb?: number; total_kb?: number }
  cpu_temp_c?: number
  media_graph?: {
    state?: string
    working?: boolean
    visual_quality?: string
    input_size?: string
    output_size?: string
  }
  performance?: {
    degraded?: boolean
    score?: number
    status?: string
  }
  tailnet?: {
    ok?: boolean
    state?: string
    tailnet_route_ok?: boolean
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
  const score = sys?.performance?.score
  const mediaWorking = sys?.media_graph?.working
  const mediaQuality = sys?.media_graph?.visual_quality
  const tailnetOk = sys?.tailnet?.ok && sys?.tailnet?.tailnet_route_ok !== false
  const cameraLabel = mediaWorking
    ? mediaQuality === 'calibrated'
      ? 'Calibrated'
      : 'Working'
    : online
      ? 'Check'
      : '—'
  const networkLabel = tailnetOk ? 'Routed' : online ? 'Check' : '—'
  const scoreColor = typeof score === 'number' && score < 90
    ? (isLight ? '#b45309' : '#fcd34d')
    : valueColor

  return (
    <div
      className={`relative rounded-2xl h-full flex flex-col overflow-hidden ${compact ? 'p-5 md:p-6' : 'p-7 md:p-8'}`}
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

      <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-4' : 'mb-5'}`}>
        <div
          className={`${compact ? 'text-[10px]' : 'text-[10.5px]'} font-semibold uppercase tracking-[0.22em]`}
          style={{ color: isLight ? '#0f9d4f' : 'rgba(74, 222, 128, 0.9)' }}
        >
          Health
        </div>
        {compact && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
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
          className={`${compact ? 'text-[10.5px] mb-3 -mt-2 truncate' : 'text-[11px] mb-4 -mt-2'} tracking-tight`}
          style={{
            color: isLight ? '#b45309' : '#fcd34d',
            opacity: 0.9,
          }}
        >
          <span style={{ fontWeight: 600 }}>Degraded:</span>{' '}
          {digest.servicesDown.join(', ')}
        </div>
      )}

      <dl className={`grid grid-cols-2 ${compact ? 'mt-1 gap-x-4 gap-y-3' : 'mt-auto gap-x-6 gap-y-4'}`}>
        <div>
          <dt
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Score
          </dt>
          <dd
            className={`${compact ? 'text-[18px] md:text-[19px]' : 'text-[20px] sm:text-[22px]'} font-semibold tracking-tight tabular-nums mt-1`}
            style={{ color: scoreColor }}
          >
            {typeof score === 'number' ? score : (online ? 'OK' : '—')}
            {typeof score === 'number' && (
              <span className="text-[12px] font-medium ml-0.5" style={{ color: palette.mutedText }}>/100</span>
            )}
          </dd>
        </div>
        <div>
          <dt
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Camera
          </dt>
          <dd
            className={`${compact ? 'text-[18px] md:text-[19px]' : 'text-[20px] sm:text-[22px]'} font-semibold tracking-tight mt-1`}
            style={{ color: valueColor }}
          >
            {cameraLabel}
          </dd>
        </div>
        <div>
          <dt
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Network
          </dt>
          <dd
            className={`${compact ? 'text-[18px] md:text-[19px]' : 'text-[20px] sm:text-[22px]'} font-semibold tracking-tight mt-1`}
            style={{ color: valueColor }}
          >
            {networkLabel}
          </dd>
        </div>
        <div>
          <dt
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Services
          </dt>
          <dd
            className={`${compact ? 'text-[18px] md:text-[19px]' : 'text-[20px] sm:text-[22px]'} font-semibold tracking-tight tabular-nums mt-1`}
            style={{ color: valueColor }}
          >
            {digest
              ? `${digest.servicesUp}/${digest.servicesTotal}`
              : (lastOk ? `${lastOk.servicesUp}/${lastOk.servicesTotal}` : '—')}
          </dd>
        </div>
      </dl>

      {sys && (
        <div
          className={`${compact ? 'mt-3 pt-2 gap-x-3 text-[10px]' : 'mt-4 pt-3 gap-x-4 text-[11px]'} border-t flex flex-wrap gap-y-1 tabular-nums`}
          style={{
            borderColor: palette.hairline,
            color: palette.mutedText,
          }}
        >
          {typeof sys.cpu_temp_c === 'number' && sys.cpu_temp_c > 0 && (
            <span>SoC {sys.cpu_temp_c.toFixed(0)}°C</span>
          )}
          <span>up {digest ? fmtUptime(digest.uptimeSec) : (lastOk ? fmtUptime(lastOk.uptimeSec) : '—')}</span>
          <span>checked {digest ? 'now' : (lastOk ? fmtAge(Date.now() - lastOk.fetchedAt) : '—')}</span>
          {sys.mem && typeof sys.mem.cma_free_kb === 'number' && (
            <span>cma {Math.round((sys.mem.cma_free_kb || 0) / 1024)}M</span>
          )}
          {typeof sys.tailscale_kicks_4h === 'number' && sys.tailscale_kicks_4h > 0 && (
            <span style={{ color: isLight ? '#b45309' : '#fcd34d' }}>
              ts kicks {sys.tailscale_kicks_4h}/4h
            </span>
          )}
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
