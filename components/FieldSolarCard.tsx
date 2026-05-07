'use client'

/**
 * FieldSolarCard — battery, solar in, SOC bar, 24h solar history.
 *
 * Polls the same-origin solar proxy every 30s. Charts use the dedicated
 * `/api/v3/solar/history` endpoint so the compact bento shows real 24-hour
 * history once the Raspberry Pi/relay exporter is online.
 *
 * Theme: card chrome / typography swap via useFieldTheme(); the warm amber
 * sparkline + green→cyan SOC gradient stay constant in both themes.
 */

import { useEffect, useState } from 'react'
import { useFieldTheme } from './fieldTheme'

const SOLAR_URL = '/api/v3/solar'
const SOLAR_HISTORY_URL = '/api/v3/solar/history'

type Solar = {
  battery_voltage: number
  battery_soc?: number
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

type SolarHistoryPoint = {
  battery_voltage: number
  solar_power: number
  timestamp: number
}

function fmtAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Fallback 4S LiFePO4 SOC curve. The relay publishes battery_soc using the
// same Pi dashboard formula; keep this as a client-side fallback only.
function calcSOC(bv: number, chargeA = 0): number {
  const ocv = bv - chargeA * 0.03
  const table: [number, number][] = [
    [10.0, 0], [12.5, 9], [12.7, 14], [12.8, 17],
    [12.9, 20], [13.0, 30], [13.1, 40], [13.2, 70],
    [13.3, 90], [13.4, 99], [13.6, 100],
  ]
  if (ocv <= table[0][0]) return 0
  if (ocv >= table[table.length - 1][0]) return 100
  for (let i = 0; i < table.length - 1; i++) {
    if (ocv >= table[i][0] && ocv <= table[i + 1][0]) {
      const range = table[i + 1][0] - table[i][0]
      const frac = (ocv - table[i][0]) / range
      return Math.round(table[i][1] + frac * (table[i + 1][1] - table[i][1]))
    }
  }
  return 0
}

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
  const [history, setHistory] = useState<SolarHistoryPoint[]>([])

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

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 8000)
        const res = await fetch(SOLAR_HISTORY_URL, { signal: ctrl.signal, cache: 'no-store' })
        clearTimeout(t)
        if (!cancelled && res.ok) {
          const data = await res.json()
          setHistory(normalizeHistory(data))
        }
      } catch {
        if (!cancelled) setHistory([])
      }
      timer = setTimeout(tick, 5 * 60_000)
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const soc = solar
    ? Math.round(typeof solar.battery_soc === 'number'
      ? solar.battery_soc
      : calcSOC(solar.battery_voltage, solar.charging_current))
    : null
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
  const hasHistory = history.length >= 2
  const solarHistory = history.map((p) => p.solar_power)
  const voltageHistory = history.map((p) => p.battery_voltage)

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

      {/* Secondary stats */}
      <div className={`grid grid-cols-3 ${compact ? 'gap-3 mb-4' : 'gap-5 mb-5'}`}>
        <div>
          <div
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Solar in
          </div>
          <div
            className={`${compact ? 'text-[20px]' : 'text-[24px] sm:text-[26px]'} font-semibold tracking-tight tabular-nums mt-1`}
            style={{
              color: hasValues && solar.solar_power > 0
                ? (isLight ? '#c2410c' : '#ffb84d')
                : valueColor,
              opacity: state === 'stale' ? 0.7 : 1,
            }}
          >
            {hasValues ? Math.round(solar.solar_power) : '—'}
            <span className="text-[12px] font-medium ml-1" style={{ color: palette.mutedText }}>W</span>
          </div>
        </div>
        <div>
          <div
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] font-medium`}
            style={{ color: palette.mutedText }}
          >
            Load
          </div>
          <div
            className={`${compact ? 'text-[20px]' : 'text-[24px] sm:text-[26px]'} font-semibold tracking-tight tabular-nums mt-1`}
            style={{ color: valueColor, opacity: state === 'stale' ? 0.7 : 1 }}
          >
            {hasValues ? solar.load_current.toFixed(1) : '—'}
            <span className="text-[12px] font-medium ml-1" style={{ color: palette.mutedText }}>A</span>
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
            className={`${compact ? 'text-[20px]' : 'text-[24px] sm:text-[26px]'} font-semibold tracking-tight tabular-nums mt-1`}
            style={{ color: valueColor, opacity: state === 'stale' ? 0.7 : 1 }}
          >
            {hasValues ? solar.yield_today : '—'}
            <span className="text-[12px] font-medium ml-1" style={{ color: palette.mutedText }}>Wh</span>
          </div>
        </div>
      </div>

      {compact ? (
        <div className="mt-2 grid grid-rows-2 gap-3 flex-1 min-h-[190px]">
          <div
            className="rounded-xl border p-3 flex flex-col min-h-0"
            style={{
              borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
              background: isLight ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.025)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="text-[9px] uppercase tracking-[0.18em] font-medium"
                style={{ color: palette.mutedText }}
              >
                Solar input · 24h
              </div>
              <div className="text-[10px] tabular-nums" style={{ color: palette.fadedText }}>
                {hasValues ? `${Math.round(solar.solar_power)} W` : 'waiting'}
              </div>
            </div>
            {hasHistory ? (
              <Sparkline
                data={solarHistory}
                isLight={isLight}
                className="w-full flex-1 min-h-[76px]"
                gradientId="solarSparkAreaCompact"
                tone="solar"
              />
            ) : (
              <HistoryPlaceholder isLight={isLight} label="Pi 24h source pending" />
            )}
          </div>
          <div
            className="rounded-xl border p-3 flex flex-col min-h-0"
            style={{
              borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
              background: isLight ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="text-[9px] uppercase tracking-[0.18em] font-medium"
                style={{ color: palette.mutedText }}
              >
                Battery voltage · 24h
              </div>
              <div className="text-[10px] tabular-nums" style={{ color: palette.fadedText }}>
                {hasValues ? `${solar.battery_voltage.toFixed(2)} V` : 'waiting'}
              </div>
            </div>
            {hasHistory ? (
              <Sparkline
                data={voltageHistory}
                isLight={isLight}
                className="w-full flex-1 min-h-[76px]"
                gradientId="voltageSparkAreaCompact"
                tone="battery"
              />
            ) : (
              <HistoryPlaceholder isLight={isLight} label="Waiting for Pi history" />
            )}
          </div>
        </div>
      ) : (
        <div
          className="mt-auto pt-4 border-t"
          style={{ borderColor: palette.hairline }}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-medium"
              style={{ color: palette.mutedText }}
            >
              Solar input · 24h
            </div>
            <div
              className="text-[10px] tracking-wide"
              style={{ color: palette.fadedText }}
            >
              history
            </div>
          </div>
          {hasHistory ? (
            <Sparkline data={solarHistory} isLight={isLight} />
          ) : (
            <HistoryPlaceholder isLight={isLight} label="Pi 24h history pending" />
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes fldSolarIdlePulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.25); }
        }
      `}</style>
    </div>
  )
}

function normalizeHistory(data: unknown): SolarHistoryPoint[] {
  const root = data as { points?: unknown; history?: unknown; data?: unknown; buckets?: unknown }
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(root?.points)
      ? root.points
      : Array.isArray(root?.history)
        ? root.history
        : Array.isArray(root?.data)
          ? root.data
          : Array.isArray(root?.buckets)
            ? root.buckets
            : []
  const cutoff = Date.now() / 1000 - 24 * 60 * 60

  return raw
    .map((item) => {
      const p = item as Record<string, unknown>
      const timestamp = numeric(p.timestamp ?? p.ts ?? p.time)
      const solarPower = numeric(p.solar_power ?? p.solarPower ?? p.pv_power_w ?? p.pvPowerW)
      const batteryVoltage = numeric(p.battery_voltage ?? p.batteryVoltage ?? p.battery_v ?? p.batteryV)
      if (timestamp == null || solarPower == null || batteryVoltage == null) return null
      const seconds = timestamp > 10_000_000_000 ? timestamp / 1000 : timestamp
      if (seconds < cutoff) return null
      return {
        timestamp: seconds,
        solar_power: solarPower,
        battery_voltage: batteryVoltage,
      }
    })
    .filter((p): p is SolarHistoryPoint => p != null)
    .sort((a, b) => a.timestamp - b.timestamp)
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function HistoryPlaceholder({ isLight, label }: { isLight: boolean; label: string }) {
  const lineColor = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)'
  const textColor = isLight ? 'rgba(28,26,28,0.45)' : 'rgba(255,255,255,0.35)'

  return (
    <div className="relative flex-1 min-h-[50px]">
      <svg viewBox="0 0 280 36" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <line x1="0" y1="35" x2="280" y2="35" stroke={lineColor} strokeWidth="1" />
        <path
          d="M0 28 C 45 24, 74 30, 112 22 S 190 18, 280 24"
          fill="none"
          stroke={lineColor}
          strokeWidth="1.2"
          strokeDasharray="4 5"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: textColor }}
      >
        {label}
      </div>
    </div>
  )
}

function Sparkline({
  data,
  isLight,
  className = 'w-full h-24',
  gradientId = 'solarSparkArea',
  tone = 'solar',
}: {
  data: number[]
  isLight: boolean
  className?: string
  gradientId?: string
  tone?: 'solar' | 'battery'
}) {
  const W = 320
  const H = 112
  const PAD_L = 38
  const PAD_R = 8
  const PAD_T = 10
  const PAD_B = 24
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const strokeColor = tone === 'battery'
    ? (isLight ? '#0a8aa8' : '#67e8f9')
    : (isLight ? '#c2410c' : '#ffb84d')
  const areaTop = tone === 'battery'
    ? (isLight ? 'rgba(10,138,168,0.24)' : 'rgba(103,232,249,0.30)')
    : (isLight ? 'rgba(194,65,12,0.30)' : 'rgba(255,184,77,0.4)')
  const areaBottom = tone === 'battery'
    ? (isLight ? 'rgba(10,138,168,0)' : 'rgba(103,232,249,0)')
    : (isLight ? 'rgba(194,65,12,0)' : 'rgba(255,184,77,0)')
  const baselineColor = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)'
  const axisColor = isLight ? 'rgba(28,26,28,0.45)' : 'rgba(255,255,255,0.42)'
  const gridColor = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.10)'

  if (data.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
        <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke={baselineColor} strokeWidth="1" />
      </svg>
    )
  }

  const rawMax = Math.max(...data)
  const rawMin = Math.min(...data)
  const yMin = tone === 'solar'
    ? 0
    : Math.floor((rawMin - 0.02) * 20) / 20
  const yMax = tone === 'solar'
    ? niceCeil(Math.max(5, rawMax))
    : Math.ceil((rawMax + 0.02) * 20) / 20
  const range = Math.max(tone === 'solar' ? 1 : 0.05, yMax - yMin)
  const stepX = innerW / (data.length - 1)
  const yFor = (v: number) => PAD_T + innerH - ((v - yMin) / range) * innerH
  const linePath = buildSmoothPath(data.map((v, i) => [
    PAD_L + i * stepX,
    yFor(v),
  ]))
  const areaPath = `${linePath} L ${PAD_L + innerW} ${PAD_T + innerH} L ${PAD_L} ${PAD_T + innerH} Z`
  const tickValues = tone === 'solar'
    ? [yMax, yMax / 2, 0]
    : [yMax, yMin + range / 2, yMin]
  const current = data[data.length - 1]
  const currentX = PAD_L + innerW
  const currentY = yFor(current)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={areaTop} />
          <stop offset="100%" stopColor={areaBottom} />
        </linearGradient>
      </defs>
      {tickValues.map((value, index) => {
        const y = yFor(value)
        return (
          <g key={`${value}-${index}`}>
            <line
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke={gridColor}
              strokeWidth={index === tickValues.length - 1 ? 1.1 : 0.8}
            />
            <text
              x={PAD_L - 5}
              y={y + 3}
              textAnchor="end"
              fontSize="9"
              fontWeight="650"
              fill={axisColor}
            >
              {formatTick(value, tone)}
            </text>
          </g>
        )
      })}
      {['24h', '12h', 'now'].map((label, index) => {
        const x = PAD_L + (index / 2) * innerW
        return (
          <text
            key={label}
            x={x}
            y={H - 5}
            textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}
            fontSize="9"
            fontWeight="650"
            fill={axisColor}
          >
            {label}
          </text>
        )
      })}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={currentX}
        cy={currentY}
        r="3"
        fill={strokeColor}
        stroke={isLight ? 'rgba(255,255,255,0.92)' : 'rgba(12,12,14,0.92)'}
        strokeWidth="1.4"
      />
    </svg>
  )
}

function niceCeil(value: number): number {
  if (value <= 10) return 10
  if (value <= 25) return 25
  if (value <= 50) return 50
  if (value <= 100) return 100
  return Math.ceil(value / 50) * 50
}

function formatTick(value: number, tone: 'solar' | 'battery'): string {
  if (tone === 'solar') return `${Math.round(value)}`
  return value.toFixed(2)
}

function buildSmoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return ''
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const cx = (x0 + x1) / 2
    d += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  return d
}
