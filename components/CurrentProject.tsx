'use client'

import { useEffect, useState } from 'react'

const SOLAR_CAMERA_URL = 'https://imx95-var-dart.tailc7d6b6.ts.net'

interface SolarData {
  battery_voltage: number
  charging_current: number
  solar_power: number
  yield_today: number
  charge_state: string
  load_current: number
  timestamp: string
}

interface WeatherData {
  temp: number
  description: string
  emoji: string
  isDay: boolean
}

const wxCodes: Record<number, string> = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Storms',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'}
const wxDayEmoji: Record<number, string> = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'}
const wxNightEmoji: Record<number, string> = {0:'🌙',1:'🌙',2:'☁️',3:'☁️',45:'🌫️',48:'🌫️',51:'🌧️',53:'🌧️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌧️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${online ? 'bg-green-500' : 'bg-red-500'}`} />
    </span>
  )
}

function calcSOC(bv: number) {
  if (bv >= 14.4) return 100
  if (bv >= 13.6) return 99
  if (bv >= 13.4) return 95
  if (bv >= 13.3) return 80
  if (bv >= 13.2) return 50
  if (bv >= 13.1) return 30
  if (bv >= 13.0) return 20
  if (bv >= 12.8) return 14
  if (bv >= 12.0) return 9
  return 0
}

export default function CurrentProject() {
  const [solar, setSolar] = useState<SolarData | null>(null)
  const [online, setOnline] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    const fetchSolar = async () => {
      try {
        const res = await fetch(`${SOLAR_CAMERA_URL}/api/solar`, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          setSolar(data)
          setOnline(true)
        } else {
          setOnline(false)
        }
      } catch {
        setOnline(false)
      }
    }
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=30.2672&longitude=-97.7431&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit')
        if (res.ok) {
          const data = await res.json()
          const c = data.current
          const isDay = c.is_day === 1
          setWeather({
            temp: Math.round(c.temperature_2m),
            description: wxCodes[c.weather_code] || 'Unknown',
            emoji: isDay ? (wxDayEmoji[c.weather_code] || '❓') : (wxNightEmoji[c.weather_code] || '❓'),
            isDay,
          })
        }
      } catch {}
    }
    fetchSolar()
    fetchWeather()
    const solarInterval = setInterval(fetchSolar, 15000)
    const wxInterval = setInterval(fetchWeather, 300000)
    return () => { clearInterval(solarInterval); clearInterval(wxInterval) }
  }, [])

  const loadW = solar ? (solar.load_current * solar.battery_voltage).toFixed(1) : '--'
  const soc = solar ? calcSOC(solar.battery_voltage) : null
  const netW = solar ? (solar.solar_power - parseFloat(loadW as string)).toFixed(1) : '--'

  return (
    <section id="now" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <StatusDot online={online} />
            {online ? 'Live System' : 'Currently Building'}
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">What I&apos;m Working On</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Project Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 p-6 sm:p-8 md:p-10 border-2 border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
            {/* Icon/Visual */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 text-center md:text-left">
                Solar-Powered Smart Camera System
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4 text-sm sm:text-base">
                Designing a compact, self-contained surveillance system capable of true 24/7 recording using
                modular off-the-shelf components. By combining edge compute hardware with cellular connectivity
                and solar power, we can deliver always-on monitoring at a fraction of commercial system costs.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 text-sm sm:text-base">
                This approach eliminates vendor lock-in, reduces size and complexity compared to bulky
                trailer-based solutions, and provides full flexibility for AI analytics and cloud integration.
              </p>

              {/* Live Telemetry - only shown when system is online */}
              {online && solar ? (
                <>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 sm:p-5 mb-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <StatusDot online={true} />
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Live Telemetry</span>
                      <span className="text-xs text-gray-400 ml-auto">{solar.timestamp}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-yellow-500">{solar.solar_power}W</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Solar Input</div>
                      </div>
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-green-500">{solar.battery_voltage.toFixed(1)}V</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Battery ({soc}%)</div>
                      </div>
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-red-400">{loadW}W</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">System Load</div>
                      </div>
                      <div>
                        <div className={`text-xl sm:text-2xl font-bold ${parseFloat(netW as string) >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                          {parseFloat(netW as string) > 0 ? '+' : ''}{netW}W
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Net Power</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {solar.charge_state} &bull; {solar.charging_current.toFixed(1)}A charging &bull; Yield: {(solar.yield_today / 100).toFixed(2)} kWh
                      </span>
                      {weather && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {weather.emoji} {weather.temp}&deg;F {weather.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Links - only shown when online */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    <a
                      href={`${SOLAR_CAMERA_URL}/analytics`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors border border-cyan-200 dark:border-cyan-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Live Analytics Dashboard
                    </a>
                    <a
                      href={`${SOLAR_CAMERA_URL}/cam`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Live Camera Feed
                      <span className="text-xs opacity-60">(password protected)</span>
                    </a>
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 sm:p-5 mb-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusDot online={false} />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">System Status</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    The prototype is currently offline for development. Live telemetry and analytics will appear here when the system is running.
                  </p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">24/7</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Recording</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">~10%</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cost of commercial</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">5G</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Connected</div>
                </div>
              </div>

              {/* Tech Tags */}
              <div className="flex flex-wrap gap-2 mt-6">
                {['24/7 Recording', 'Solar Power', 'Edge Computing', '5G Cellular', 'T-Mobile NR', 'LiFePO4', 'MPPT', 'Computer Vision', 'Docker', 'H.264'].map((tech, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
