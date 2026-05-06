'use client'

/**
 * FieldSolarCard — battery, solar in, SOC bar, session-buffer sparkline.
 *
 * Polls the same-origin solar proxy every 30s. Builds a rolling client-side
 * ring buffer of solar power readings across the user's session — clearly
 * labelled "session" so it's not misread as a 24h history.
 *
 * Theme: card chrome / typography swap via useFieldTheme(); the warm amber
 * sparkline + green→cyan SOC gradient stay constant in both themes.
 */

import { useEffect, useRef, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const SOLAR_URL = '/api/v3/solar'

type Solar = {
  battery_voltage: number
  charging_current: number
  solar_power: number
  yield_today: number
  charge_state: string
  load_current: number
  timestamp: number
  load_on?: boolean
  // Added 2026-05-04: server reports stale-ness so the UI can show last
  // known telemetry instead of "no telemetry yet" while the BLE link is
  // recovering. live=true ⇔ age_seconds <= 90s.
  age_seconds?: number
  stale?: boolean
  live?: boolean
  error?: string
}

type CardState = 'loading' | 'live' | 'stale' | 'no-telemetry' | 'offline'
type SolarCardVariant = 'default' | 'compact'

function fmtAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// 4S LiFePO4 OCV → SOC, with internal-resistance compensation.
function calcSOC(bv: number, loadA = 0, chargeA = 0): number {
  const ocv = bv + (loadA * 0.025) - (Math.max(0, chargeA) * 0.025)
  const table: [number, number][] = [
    [14.4, 100], [13.6, 99], [13.4, 95], [13.35, 90],
    [13.3, 80], [13.25, 70], [13.2, 60], [13.15, 50],
    [13.1, 40], [13.05, 30], [13.0, 25], [12.9, 20],
    [12.8, 15], [12.5, 10], [12.0, 7], [11.5, 4], [11.0, 0],
  ]
  if (ocv >= table[0][0]) return 100
  if (ocv <= table[table.length - 1][0]) return 0
  for (let i = 0; i < table.length - 1; i++) {
    if (ocv >= table[i + 1][0]) {
      const range = table[i][0] - table[i + 1][0]
      const frac = (ocv - table[i + 1][0]) / range
      return Math.round(table[i + 1][1] + frac * (table[i][1] - table[i + 1][1]))
    }
  }
  return 0
}

const SPARK_MAX = 60 // 60 samples × 30s ≈ 30 minutes of session history

export default function FieldSolarCard({
  variant = 'default',
}: {
  variant?: SolarCardVariant
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const compact = variant === 'compact'

  const [solar, setSolar] = useState<Solar | null>(null)
  const [state, setState] = useState<CardState>('loading')
  const [spark, setSpark] = useState<number[]>([])
  const sparkRef = useRef<number[]>([])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 8000)
        const res = await fetch(SOLAR_URL, { signal: ctrl.signal, cache: 'no-store' })
        clearTimeout(t)
        if (cancelled) return

        // Read body even on non-2xx — the upstream's 503 carries useful
        // info ({"error":"no telemetry yet"}). We treat any successful HTTP
        // round-trip with parseable JSON as "we heard from the device";
        // only true network/proxy failures count as 'offline'.
        let data: Partial<Solar> & { error?: string } | null = null
        try {
          data = await res.json()
        } catch {
          data = null
        }

        if (data && typeof data.battery_voltage === 'number' && !data.error) {
          const reading = data as Solar
          setSolar(reading)
          // Server now distinguishes live (recent) from stale (cached
          // last-known). Both render the values; only the badge differs.
          setState(reading.live === false || reading.stale === true ? 'stale' : 'live')
          // Don't pad the sparkline with stale repeats — only push when
          // the data is genuinely new.
          if (reading.live !== false) {
            const next = [...sparkRef.current, reading.solar_power].slice(-SPARK_MAX)
            sparkRef.current = next
            setSpark(next)
          }
        } else if (data && (data.error || res.status === 503)) {
          // Upstream is reachable but reports no telemetry yet (BMV never
          // seen since boot). Treat as 'idle / awaiting', not broken.
          setState('no-telemetry')
        } else if (!res.ok) {
          // Proxy or upstream actively failing (502 / unreachable).
          setState('offline')
        } else {
          // 2xx but unparseable / unexpected shape.
          setState('no-telemetry')
        }
      } catch {
        if (!cancelled) setState('offline')
      }
      timer = setTimeout(tick, 30_000)
    }
    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const soc = solar ? calcSOC(solar.battery_voltage, solar.load_current, solar.charging_current) : null
  // Display values whenever we have a reading at all, fresh or stale.
  // Only "no-telemetry" / "offline" / "loading" hide the numbers.
  const hasValues = (state === 'live' || state === 'stale') && solar != null
  const live = state === 'live' && solar != null
  const valueColor = isLight ? '#1c1a1c' : '#fff'
  const statusLabel = live
    ? 'live'
    : state === 'stale'
      ? 'stale'
      : state === 'loading'
        ? 'connecting'
        : state === 'no-telemetry'
          ? 'waiting'
          : 'offline'

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
      aria-label="Solar power and battery"
    >
      {/* Ambient warm glow */}
      <div
        className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(255,159,10,${isLight ? 0.1 : 0.16}), transparent 70%)`,
        }}
      />

      <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-4' : 'mb-5'}`}>
        <div
          className={`${compact ? 'text-[10px]' : 'text-[10.5px]'} font-semibold uppercase tracking-[0.22em]`}
          style={{ color: isLight ? '#b45309' : 'rgba(252, 211, 77, 0.9)' /* amber-300/90 */ }}
        >
          Solar
        </div>
        {compact && (
          <div
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{
              color: live
                ? (isLight ? '#0f9d4f' : '#86efac')
                : state === 'stale'
                  ? (isLight ? '#b45309' : '#fcd34d')
                  : palette.mutedText,
              background: live
                ? (isLight ? 'rgba(15,157,79,0.08)' : 'rgba(134,239,172,0.10)')
                : state === 'stale'
                  ? (isLight ? 'rgba(180,83,9,0.10)' : 'rgba(252,211,77,0.12)')
                  : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
              border: palette.cardBorder,
            }}
          >
            {statusLabel}
          </div>
        )}
      </div>

      {/* Hero number — battery voltage */}
      <div className="flex items-baseline gap-2 mb-1">
        <div
          className={`${compact ? 'text-[54px] md:text-[58px]' : 'text-[56px] sm:text-[68px]'} font-semibold leading-none tracking-tight tabular-nums`}
          style={{
            // backgroundImage longhand — `background:` shorthand resets
            // background-clip back to default and the gradient renders as
            // a solid block instead of clipping to the glyphs.
            backgroundImage: palette.headlineGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {hasValues ? solar.battery_voltage.toFixed(2) : '—'}
        </div>
        <div
          className={`${compact ? 'text-[20px]' : 'text-[20px] sm:text-[24px]'} font-medium tracking-tight`}
          style={{ color: palette.mutedText }}
        >
          V
        </div>
      </div>
      <div
        className={`${compact ? 'text-[12px] mb-4' : 'text-[13px] mb-6'} tracking-tight flex items-center gap-2`}
        style={{ color: palette.bodyText, minHeight: '1.25rem' }}
      >
        {hasValues ? (
          <>
            <span>
              Battery <span className="tabular-nums" style={{ color: valueColor, opacity: 0.85 }}>{soc}%</span>
              <span className="mx-2" style={{ color: palette.fadedText }}>·</span>
              <span className="capitalize">{solar.charge_state}</span>
              {state === 'stale' && solar.age_seconds != null && (
                <>
                  <span className="mx-2" style={{ color: palette.fadedText }}>·</span>
                  <span style={{ color: isLight ? '#b45309' : '#fcd34d' }}>
                    last seen {fmtAge(solar.age_seconds)}
                  </span>
                </>
              )}
            </span>
          </>
        ) : state === 'loading' ? (
          <span style={{ color: palette.mutedText }}>Connecting…</span>
        ) : state === 'no-telemetry' ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: isLight ? '#b45309' : '#fcd34d',
                boxShadow: isLight ? '0 0 6px rgba(180,83,9,0.45)' : '0 0 8px rgba(252,211,77,0.55)',
                animation: 'fldSolarIdlePulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
              }}
            />
            <span>
              Awaiting telemetry
              <span className="mx-2" style={{ color: palette.fadedText }}>·</span>
              <span style={{ color: palette.mutedText }}>sensor link inactive</span>
            </span>
          </>
        ) : (
          <span style={{ color: palette.mutedText }}>Telemetry unreachable</span>
        )}
      </div>

      {/* SOC bar — bigger, with depth */}
      <div className={`relative ${compact ? 'mb-5' : 'mb-7'}`}>
        <div
          className="h-2.5 w-full rounded-full overflow-hidden"
          style={{ background: palette.trackBackground }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: hasValues ? `${Math.max(0, Math.min(100, soc ?? 0))}%` : '0%',
              background: 'linear-gradient(90deg, #30d158 0%, #06d6f4 100%)',
              boxShadow: '0 0 12px rgba(6,214,244,0.4)',
              transition: 'width 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Two secondary stats */}
      <div className={`grid grid-cols-2 ${compact ? 'gap-4 mb-4' : 'gap-6 mb-5'}`}>
        <div>
          <div
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Solar in
          </div>
          <div
            className={`${compact ? 'text-[24px]' : 'text-[26px] sm:text-[28px]'} font-semibold tracking-tight tabular-nums mt-1`}
            style={{
              color: hasValues && solar.solar_power > 0
                ? (isLight ? '#c2410c' : '#ffb84d')
                : valueColor,
              opacity: state === 'stale' ? 0.7 : 1,
            }}
          >
            {hasValues ? Math.round(solar.solar_power) : '—'}
            <span className="text-[14px] font-medium ml-1" style={{ color: palette.mutedText }}>W</span>
          </div>
        </div>
        <div>
          <div
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Yield today
          </div>
          <div
            className={`${compact ? 'text-[24px]' : 'text-[26px] sm:text-[28px]'} font-semibold tracking-tight tabular-nums mt-1`}
            style={{ color: valueColor, opacity: state === 'stale' ? 0.7 : 1 }}
          >
            {hasValues ? solar.yield_today : '—'}
            <span className="text-[14px] font-medium ml-1" style={{ color: palette.mutedText }}>Wh</span>
          </div>
        </div>
      </div>

      {/* Session sparkline */}
      <div
        className={compact
          ? 'mt-2 rounded-xl border p-3 flex-1 min-h-[96px] flex flex-col justify-end'
          : 'mt-auto pt-4 border-t'
        }
        style={{
          borderColor: compact ? (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)') : palette.hairline,
          background: compact
            ? (isLight ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.025)')
            : undefined,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Solar input
          </div>
          <div
            className="text-[10px] tracking-wide"
            style={{ color: palette.fadedText }}
          >
            session
          </div>
        </div>
        <Sparkline data={spark} isLight={isLight} className={compact ? 'w-full h-full min-h-[56px]' : 'w-full h-9'} />
      </div>

      <style jsx global>{`
        @keyframes fldSolarIdlePulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.25); }
        }
      `}</style>
    </div>
  )
}

function Sparkline({
  data,
  isLight,
  className = 'w-full h-9',
}: {
  data: number[]
  isLight: boolean
  className?: string
}) {
  const W = 280
  const H = 36
  const strokeColor = isLight ? '#c2410c' : '#ffb84d'
  const baselineColor = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)'

  if (data.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={baselineColor} strokeWidth="1" />
      </svg>
    )
  }
  const max = Math.max(1, ...data)
  const stepX = W / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = H - (v / max) * (H - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const areaPoints = `0,${H} ${points} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="solarSparkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isLight ? 'rgba(194,65,12,0.30)' : 'rgba(255,184,77,0.4)'} />
          <stop offset="100%" stopColor={isLight ? 'rgba(194,65,12,0)' : 'rgba(255,184,77,0)'} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#solarSparkArea)" />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
