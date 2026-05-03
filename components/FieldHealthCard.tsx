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
}

type HealthLoose = {
  ok?: boolean
  uptime_s?: number
  service_count?: number
  services?: ServiceLoose[]
  services_down?: string[] | null
}

type HealthDigest = {
  ok: boolean
  uptimeSec: number
  servicesUp: number
  servicesTotal: number
  rttMs: number
  fetchedAt: number
}

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

export default function FieldHealthCard() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  const [digest, setDigest] = useState<HealthDigest | null>(null)
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

      if (ok && parsed && parsed.ok !== false && !('error' in (parsed as object))) {
        const services = parsed.services ?? []
        const total = parsed.service_count ?? services.length
        const down = parsed.services_down?.length ?? services.filter((s) => {
          if (typeof s.OK === 'boolean') return !s.OK
          if (typeof s.ok === 'boolean') return !s.ok
          if (typeof s.status === 'string') return s.status !== 'running'
          return false
        }).length
        const up = Math.max(0, total - down)
        const next: HealthDigest = {
          ok: parsed.ok ?? (down === 0),
          uptimeSec: parsed.uptime_s ?? 0,
          servicesUp: up,
          servicesTotal: total,
          rttMs,
          fetchedAt: Date.now(),
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

  const online = digest != null && digest.ok
  const lastOk = lastOkRef.current

  const onlineHeadline = palette.headlineGradient
  const offlineHeadline = isLight
    ? 'linear-gradient(180deg, #b2261d 0%, #6e6e73 100%)'
    : 'linear-gradient(180deg, #ffb0aa 0%, #6e6e73 100%)'

  const valueColor = isLight ? '#1c1a1c' : '#fff'

  return (
    <div
      className="relative rounded-2xl p-7 md:p-8 h-full flex flex-col overflow-hidden"
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
          background: online
            ? `radial-gradient(circle, rgba(48,209,88,${isLight ? 0.12 : 0.18}), transparent 70%)`
            : `radial-gradient(circle, rgba(255,69,58,${isLight ? 0.08 : 0.12}), transparent 70%)`,
          transition: 'background 0.8s ease',
        }}
      />

      <div
        className="text-[10.5px] font-semibold uppercase tracking-[0.22em] mb-5"
        style={{ color: isLight ? '#0f9d4f' : 'rgba(74, 222, 128, 0.9)' }}
      >
        Health
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span className="relative flex h-3 w-3" aria-hidden="true">
          <span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{
              background: online ? '#30d158' : '#ff453a',
              opacity: online ? 0.55 : 0.4,
              animation: online ? 'fldHealthPing 2.2s cubic-bezier(0,0,0.2,1) infinite' : 'none',
            }}
          />
          <span
            className="relative inline-flex h-3 w-3 rounded-full"
            style={{
              background: online ? '#30d158' : '#ff453a',
              boxShadow: online ? '0 0 12px rgba(48,209,88,0.6)' : '0 0 8px rgba(255,69,58,0.5)',
            }}
          />
        </span>
        <div
          className="text-[34px] sm:text-[40px] font-semibold leading-none tracking-tight"
          style={{
            background: online ? onlineHeadline : offlineHeadline,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {online ? 'Online' : 'Offline'}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 mt-auto">
        <div>
          <dt
            className="text-[10px] uppercase tracking-[0.18em] font-medium"
            style={{ color: palette.mutedText }}
          >
            Uptime
          </dt>
          <dd
            className="text-[20px] sm:text-[22px] font-semibold tracking-tight tabular-nums mt-1"
            style={{ color: valueColor }}
          >
            {digest ? fmtUptime(digest.uptimeSec) : (lastOk ? fmtUptime(lastOk.uptimeSec) : '—')}
          </dd>
        </div>
        <div>
          <dt
            className="text-[10px] uppercase tracking-[0.18em] font-medium"
            style={{ color: palette.mutedText }}
          >
            Services
          </dt>
          <dd
            className="text-[20px] sm:text-[22px] font-semibold tracking-tight tabular-nums mt-1"
            style={{ color: valueColor }}
          >
            {digest
              ? `${digest.servicesUp}/${digest.servicesTotal}`
              : (lastOk ? `${lastOk.servicesUp}/${lastOk.servicesTotal}` : '—')}
          </dd>
        </div>
        <div>
          <dt
            className="text-[10px] uppercase tracking-[0.18em] font-medium"
            style={{ color: palette.mutedText }}
          >
            Round-trip
          </dt>
          <dd
            className="text-[20px] sm:text-[22px] font-semibold tracking-tight tabular-nums mt-1"
            style={{ color: valueColor }}
          >
            {digest ? `${digest.rttMs} ms` : (online ? '—' : '—')}
          </dd>
        </div>
        <div>
          <dt
            className="text-[10px] uppercase tracking-[0.18em] font-medium"
            style={{ color: palette.mutedText }}
          >
            Last seen
          </dt>
          <dd
            className="text-[20px] sm:text-[22px] font-semibold tracking-tight mt-1"
            style={{ color: valueColor }}
          >
            {digest ? 'just now' : (lastOk ? fmtAge(Date.now() - lastOk.fetchedAt) : '—')}
          </dd>
        </div>
      </dl>

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
