'use client'

/**
 * CayleySolarCard — battery, solar in, SOC bar, session-buffer sparkline.
 *
 * Polls /api/solar every 30s. Builds a rolling client-side ring buffer of
 * solar power readings across the user's session — clearly labelled
 * "session" so it's not misread as a 24h history.
 */

import { useEffect, useRef, useState } from 'react'

const SOLAR_URL = process.env.NEXT_PUBLIC_V3_SOLAR_URL || 'https://cayley-v3-cam.tailc7d6b6.ts.net/api/solar'

type Solar = {
  battery_voltage: number
  charging_current: number
  solar_power: number
  yield_today: number
  charge_state: string
  load_current: number
  timestamp: number
  load_on?: boolean
  error?: string
}

type CardState = 'loading' | 'live' | 'no-telemetry' | 'offline'

// 4S LiFePO4 OCV → SOC, with internal-resistance compensation. Same table
// as the legacy CurrentProject for parity with what the user has been
// reading on the live board.
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

export default function CayleySolarCard() {
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
        if (!res.ok) {
          setState('offline')
        } else {
          const data: Solar | { error: string } = await res.json()
          if ('error' in data) {
            setState('no-telemetry')
          } else if (typeof data.battery_voltage === 'number') {
            setSolar(data)
            setState('live')
            // append solar_power to sparkline buffer
            const next = [...sparkRef.current, data.solar_power].slice(-SPARK_MAX)
            sparkRef.current = next
            setSpark(next)
          } else {
            setState('no-telemetry')
          }
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
  const live = state === 'live' && solar != null

  return (
    <div
      className="relative rounded-3xl p-7 md:p-8 h-full flex flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, rgba(20,20,24,0.85) 0%, rgba(10,10,12,0.85) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      role="region"
      aria-label="Solar power and battery"
    >
      {/* Ambient warm glow */}
      <div
        className="pointer-events-none absolute -top-20 -left-20 w-56 h-56 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,159,10,0.16), transparent 70%)',
        }}
      />

      <div className="text-amber-300/90 text-[10.5px] font-semibold uppercase tracking-[0.22em] mb-5">
        Solar
      </div>

      {/* Hero number — battery voltage */}
      <div className="flex items-baseline gap-2 mb-1">
        <div
          className="text-[56px] sm:text-[68px] font-semibold leading-none tracking-tight tabular-nums"
          style={{
            background: 'linear-gradient(180deg, #fff 0%, #b0b0b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {live ? solar.battery_voltage.toFixed(2) : '—'}
        </div>
        <div className="text-[20px] sm:text-[24px] font-medium text-white/40 tracking-tight">V</div>
      </div>
      <div className="text-[13px] text-white/50 tracking-tight mb-6">
        {live ? (
          <>
            Battery <span className="text-white/80 tabular-nums">{soc}%</span>
            <span className="text-white/30 mx-2">·</span>
            <span className="capitalize">{solar.charge_state}</span>
          </>
        ) : (
          state === 'loading' ? 'Connecting to the board…'
            : state === 'no-telemetry' ? 'Awaiting Victron BLE packet'
            : 'Telemetry unreachable'
        )}
      </div>

      {/* SOC bar — bigger, with depth */}
      <div className="relative mb-7">
        <div
          className="h-2.5 w-full rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: live ? `${Math.max(0, Math.min(100, soc ?? 0))}%` : '0%',
              background: 'linear-gradient(90deg, #30d158 0%, #06d6f4 100%)',
              boxShadow: '0 0 12px rgba(6,214,244,0.4)',
              transition: 'width 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Two secondary stats */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium">Solar in</div>
          <div className="text-[26px] sm:text-[28px] font-semibold tracking-tight tabular-nums mt-1"
            style={{ color: live && solar.solar_power > 0 ? '#ffb84d' : 'rgba(255,255,255,0.85)' }}>
            {live ? Math.round(solar.solar_power) : '—'}
            <span className="text-[14px] font-medium text-white/40 ml-1">W</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium">Yield today</div>
          <div className="text-[26px] sm:text-[28px] font-semibold tracking-tight tabular-nums mt-1 text-white">
            {live ? solar.yield_today : '—'}
            <span className="text-[14px] font-medium text-white/40 ml-1">Wh</span>
          </div>
        </div>
      </div>

      {/* Session sparkline */}
      <div className="mt-auto pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium">
            Solar input
          </div>
          <div className="text-[10px] tracking-wide text-white/30">session</div>
        </div>
        <Sparkline data={spark} />
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  // SVG sparkline. We always render a 36px-tall strip; if no data yet,
  // render a faint baseline so the layout doesn't shift.
  const W = 280
  const H = 36
  if (data.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-9">
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-9" aria-hidden="true">
      <defs>
        <linearGradient id="solarSparkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,184,77,0.4)" />
          <stop offset="100%" stopColor="rgba(255,184,77,0)" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#solarSparkArea)" />
      <polyline
        points={points}
        fill="none"
        stroke="#ffb84d"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
