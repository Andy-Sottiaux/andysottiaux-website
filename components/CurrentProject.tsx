'use client'

import { useEffect, useState } from 'react'

// Set NEXT_PUBLIC_V3_SOLAR_URL to the Tailscale Funnel URL (or any public
// HTTPS endpoint) to enable the live readout. Without it, the live strip
// is hidden — the page stays static.
const V3_SOLAR_URL = process.env.NEXT_PUBLIC_V3_SOLAR_URL || ''

interface SolarData {
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

type FetchState = 'idle' | 'loading' | 'live' | 'no-telemetry' | 'offline'

interface WeatherData {
  temp: number
  emoji: string
}

const wxDayEmoji: Record<number, string> = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'}
const wxNightEmoji: Record<number, string> = {0:'🌙',1:'🌙',2:'☁️',3:'☁️',45:'🌫️',48:'🌫️',51:'🌧️',53:'🌧️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌧️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
    </span>
  )
}

// 4S LiFePO4 OCV → SOC, with internal-resistance compensation
function calcSOC(bv: number, loadA = 0, chargeA = 0) {
  const ocv = bv + (loadA * 0.025) - (Math.max(0, chargeA) * 0.025)
  const table: [number, number][] = [
    [14.4, 100], [13.6, 99], [13.4, 95], [13.35, 90],
    [13.3, 80], [13.25, 70], [13.2, 60], [13.15, 50],
    [13.1, 40], [13.05, 30], [13.0, 25], [12.9, 20],
    [12.8, 15], [12.5, 10], [12.0, 7], [11.5, 4], [11.0, 0]
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

function formatRelative(ts: number | null): string {
  if (!ts) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function CurrentProject() {
  const [solar, setSolar] = useState<SolarData | null>(null)
  const [state, setState] = useState<FetchState>(V3_SOLAR_URL ? 'loading' : 'idle')
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  const [now, setNow] = useState<number>(Date.now())
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    const fetchSolar = async () => {
      if (!V3_SOLAR_URL) return
      try {
        const res = await fetch(V3_SOLAR_URL, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) { setState('offline'); return }
        const data = await res.json()
        if (data && typeof data === 'object' && 'error' in data) {
          setState('no-telemetry')
        } else if (data && typeof data.battery_voltage === 'number') {
          setSolar(data as SolarData)
          setState('live')
        } else {
          setState('no-telemetry')
        }
        setLastFetched(Date.now())
      } catch { setState('offline') }
    }
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=32.7767&longitude=-96.7970&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit')
        if (res.ok) {
          const c = (await res.json()).current
          const isDay = c.is_day === 1
          setWeather({
            temp: Math.round(c.temperature_2m),
            emoji: isDay ? (wxDayEmoji[c.weather_code] || '❓') : (wxNightEmoji[c.weather_code] || '❓'),
          })
        }
      } catch {}
    }
    fetchSolar()
    fetchWeather()
    const solarInterval = V3_SOLAR_URL ? setInterval(fetchSolar, 30000) : null
    const wxInterval = setInterval(fetchWeather, 300000)
    const tickInterval = setInterval(() => setNow(Date.now()), 5000)
    return () => {
      if (solarInterval) clearInterval(solarInterval)
      clearInterval(wxInterval)
      clearInterval(tickInterval)
    }
  }, [])

  const loadW = solar ? (solar.load_current * solar.battery_voltage).toFixed(1) : '--'
  const soc = solar ? calcSOC(solar.battery_voltage, solar.load_current, solar.charging_current) : null
  // referenced so eslint doesn't flag, and so the relative timestamp re-renders
  void now

  return (
    <section id="now" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          {(() => {
            const pill =
              state === 'live'
                ? { cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', label: 'Live · Solar Powered' }
                : state === 'no-telemetry'
                ? { cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', label: 'Camera online · awaiting telemetry' }
                : state === 'loading'
                ? { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', label: 'Connecting…' }
                : { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', label: 'Currently Building' }
            return (
              <div className={`inline-flex items-center gap-2 ${pill.cls} px-4 py-1.5 rounded-full text-sm font-medium mb-4`}>
                <StatusDot online={state === 'live'} />
                {pill.label}
              </div>
            )
          })()}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">What I&apos;m Working On</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 p-6 sm:p-8 md:p-10 border-2 border-gray-100 dark:border-gray-700">

          {/* Header row */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-8 h-8 sm:w-9 sm:h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Solar-Powered Smart Camera</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">V3 · Luckfox Pico Pi A W · Rockchip RV1106</p>
            </div>
          </div>

          {/* Lead paragraph */}
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 text-sm sm:text-base">
            A solar-powered camera node I designed end-to-end: 5MP H.265 streaming, on-device YOLO
            detection on a 1 TOPS NPU, T-Mobile LTE failover when WiFi drops, 24/7 recording to SD,
            and Victron MPPT solar telemetry decoded from Bluetooth — all running off the panel that
            also charges the battery powering it.
          </p>

          {/* Live telemetry panel — visible whenever the public endpoint is configured */}
          {V3_SOLAR_URL && (
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-4 sm:p-5 mb-6 border border-cyan-200 dark:border-cyan-800/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-cyan-700 dark:text-cyan-300">
                  <StatusDot online={state === 'live'} />
                  Live telemetry
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                  {weather && (
                    <span>{weather.emoji} {weather.temp}&deg;F</span>
                  )}
                  {lastFetched && (
                    <span title={new Date(lastFetched).toLocaleString()}>
                      updated {formatRelative(lastFetched)}
                    </span>
                  )}
                </div>
              </div>

              {state === 'live' && solar ? (
                <>
                  {/* Hero numbers */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                        {solar.battery_voltage.toFixed(2)}<span className="text-base sm:text-lg font-medium text-gray-500 dark:text-gray-400 ml-0.5">V</span>
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Battery · {soc}%</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {Math.round(solar.solar_power)}<span className="text-base sm:text-lg font-medium text-gray-500 dark:text-gray-400 ml-0.5">W</span>
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Solar in</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                        {loadW}<span className="text-base sm:text-lg font-medium text-gray-500 dark:text-gray-400 ml-0.5">W</span>
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Load</div>
                    </div>
                  </div>
                  {/* Battery SOC bar */}
                  <div className="h-1.5 w-full bg-cyan-100 dark:bg-cyan-900/40 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-cyan-500 transition-all duration-700"
                      style={{ width: `${Math.max(0, Math.min(100, soc ?? 0))}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <span className="capitalize">State: <span className="font-medium text-cyan-700 dark:text-cyan-300">{solar.charge_state}</span></span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span>Yield today: <span className="font-medium tabular-nums">{solar.yield_today} Wh</span></span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span>Charge: <span className="font-medium tabular-nums">{solar.charging_current.toFixed(2)} A</span></span>
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i}>
                        <div className={`h-7 sm:h-8 w-20 rounded ${state === 'loading' ? 'animate-pulse' : ''} bg-gray-200/70 dark:bg-gray-700/40`} />
                        <div className="h-3 w-16 mt-1 rounded bg-gray-200/50 dark:bg-gray-700/30" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {state === 'loading' && 'Connecting to the camera over Tailscale Funnel…'}
                    {state === 'no-telemetry' && 'Camera is online but hasn’t received a Victron BLE packet yet — telemetry shows up within a minute once the MPPT is in range.'}
                    {state === 'offline' && 'Endpoint unreachable right now. The camera reconnects automatically once it has WiFi or LTE.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">~3.5W</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total draw</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">8 fps</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">YOLOv5 NPU</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">5MP</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">H.265 hardware</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">20 Mbps</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">LTE failover</div>
            </div>
          </div>

          {/* Tech tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[
              'Custom kernel', 'YOLOv5s INT8', 'go2rtc WebRTC',
              'Tailscale', 'Victron BLE', 'SIM7600 Cat-4',
            ].map((tech, i) => (
              <span key={i} className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                {tech}
              </span>
            ))}
          </div>

          {/* CTAs — V3 live dashboard + click-to-watch camera via Tailscale Funnel */}
          <div className="flex flex-wrap gap-2 mb-6">
            <a
              href="https://cayley-v3-cam.tailc7d6b6.ts.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Watch live camera
            </a>
            <a
              href="https://cayley-v3-cam.tailc7d6b6.ts.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-cyan-600 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open dashboard
            </a>
          </div>

          {/* The story so far — context, not equal-weight cards */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            <span className="font-medium text-gray-700 dark:text-gray-300">How I got here.</span>{' '}
            V1 was a $600 i.MX95 prototype that proved the architecture worked.{' '}
            V2 was a $31 commodity-camera hack — same RV1106 silicon, but the vendor compiled
            the kernel without <code className="text-[11px] px-1 rounded bg-gray-100 dark:bg-gray-700">CONFIG_TUN</code> and
            the 16MB flash had no room to add it, so Tailscale was unreachable. V3 uses the
            same SoC on a board I own end-to-end: I compile the kernel, I bumped CMA so the
            NPU can run alongside the camera, and the whole thing now lives outside on the
            panel it draws from.
          </div>
        </div>
      </div>
    </section>
  )
}
