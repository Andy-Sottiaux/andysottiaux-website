'use client'

import { useEffect, useState } from 'react'

// V3 telemetry: served on the device at http://cayley-v3-cam:8089/api/solar
// (Tailscale-only, no public endpoint yet — live block is hidden by default).
// Set NEXT_PUBLIC_V3_SOLAR_URL to a publicly-reachable URL (e.g. Tailscale
// Funnel, Cloudflare Tunnel) to enable the live readout in the browser.
const V3_SOLAR_URL = process.env.NEXT_PUBLIC_V3_SOLAR_URL || ''

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

function calcSOC(bv: number, loadA = 0, chargeA = 0) {
  // Compensate for 25mOhm internal resistance, then interpolate OCV curve
  const ocv = bv + (loadA * 0.025) - (Math.max(0, chargeA) * 0.025)
  // 4S LiFePO4 OCV-to-SOC with linear interpolation
  // 11.0V = 0% (Victron cutoff), 14.4V = 100% (charge complete)
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

export default function CurrentProject() {
  const [solar, setSolar] = useState<SolarData | null>(null)
  const [online, setOnline] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    const fetchSolar = async () => {
      if (!V3_SOLAR_URL) {
        setOnline(false)
        return
      }
      try {
        const res = await fetch(V3_SOLAR_URL, { signal: AbortSignal.timeout(5000) })
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
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=32.7767&longitude=-96.7970&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit')
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
    const solarInterval = V3_SOLAR_URL ? setInterval(fetchSolar, 15000) : null
    const wxInterval = setInterval(fetchWeather, 300000)
    return () => { if (solarInterval) clearInterval(solarInterval); clearInterval(wxInterval) }
  }, [])

  const loadW = solar ? (solar.load_current * solar.battery_voltage).toFixed(1) : '--'
  const soc = solar ? calcSOC(solar.battery_voltage, solar.load_current, solar.charging_current) : null

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
                Building a fleet-deployable solar camera platform: a Rockchip RV1106 SoC running custom
                firmware, hardware H.265 encoding, LTE failover, on-device AI detection, and
                Bluetooth-decoded solar telemetry — all on ~3.5W, viewable from any browser via Tailscale.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 text-sm sm:text-base">
                V1 prototype validated the architecture on big iron. V2 (commodity-camera hack) hit a wall:
                vendor-locked kernel had no <code className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">CONFIG_TUN</code>,
                so Tailscale could not establish a tunnel and the camera was unreachable. V3 — the
                current build — uses a Luckfox Pico Pi dev board with a kernel I compile myself.
              </p>

              {/* V1 Retired */}
              <div className="bg-gray-50/50 dark:bg-gray-900/30 rounded-xl p-4 sm:p-5 mb-4 border border-gray-200 dark:border-gray-700 opacity-90">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    V1 Retired
                  </span>
                  <span className="text-xs text-gray-400">DART-MX95 Prototype · Decommissioned</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Reference design that proved the architecture: i.MX95 SBC + USB camera + 5G modem +
                  Victron MPPT. Measured 11W draw, 24-hour LiFePO4 backup, 203 Mbps 5G uplink — overkill
                  by an order of magnitude. Hardware shelved; software stack ported to V3.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground">11W</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Measured Power</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-yellow-500">84W</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Peak Solar</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-green-500">203Mbps</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">5G Speed</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground">24h</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Battery Backup</div>
                  </div>
                </div>
              </div>

              {/* V2 Abandoned */}
              <div className="bg-gray-50/50 dark:bg-gray-900/30 rounded-xl p-4 sm:p-5 mb-4 border border-gray-200 dark:border-gray-700 opacity-90">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    V2 Abandoned
                  </span>
                  <span className="text-xs text-gray-400">$31 Camera Hack · LongPlus CQ-G1</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bought a $31 off-the-shelf Chinese solar LTE camera, rooted it, replaced the streaming
                  app with our own. Hardware was excellent. Killer: the vendor compiled the kernel
                  without TUN or netfilter, and the 16MB flash had no room to add them. ~20 hours in,
                  hit a wall I could not get past on someone else&apos;s firmware. Pivoted.
                </p>
              </div>

              {/* V3 Active */}
              <div className="bg-cyan-50/50 dark:bg-cyan-900/10 rounded-xl p-4 sm:p-5 mb-6 border border-cyan-200 dark:border-cyan-800/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    V3 Active Build
                  </span>
                  <span className="text-xs text-gray-400">Luckfox Pico Pi A W · RV1106G3</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Same RV1106 silicon as V2, but on hardware I own end-to-end: custom kernel with
                  <code className="text-xs px-1 mx-0.5 bg-gray-100 dark:bg-gray-700 rounded">CONFIG_TUN=y</code>
                  +
                  <code className="text-xs px-1 mx-0.5 bg-gray-100 dark:bg-gray-700 rounded">WIREGUARD=y</code>,
                  CMA pool bumped 66M→128M so the 1 TOPS NPU can run YOLOv5 alongside the camera, ECM-mode
                  4G LTE on T-Mobile, WiFi&nbsp;6 with cellular failover, 5MP H.265 recording to SD with
                  rolling deletion, AES-128-CTR-decrypted Victron BLE solar telemetry. All services
                  cold-boot in &lt;60s.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">~3.5W</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total Power</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">8 fps</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">NPU YOLOv5</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">5MP</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">H.265 + D1 Sub</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">20 Mbps</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">LTE Cat-4 Cellular</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-cyan-200/50 dark:border-cyan-800/30 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div>✓ Custom kernel + Buildroot rootfs cross-compiled in Docker (linux/amd64 via Rosetta on Apple Silicon)</div>
                  <div>✓ MIS5001 5MP H.265 mainstream + 704×576 H.264 substream via go2rtc WebRTC; ~250 ms glass-to-glass</div>
                  <div>✓ YOLOv5s INT8 on the 1 TOPS NPU with COCO-class allowlist filtering &rarr; <code className="text-xs px-1 bg-gray-100 dark:bg-gray-700 rounded">/var/log/detections.jsonl</code></div>
                  <div>✓ Tailscale on tailnet, WiFi&harr;cellular failover proven (camera stream survives wlan0 down)</div>
                  <div>✓ Victron SmartSolar BLE Instant Readout decoded with pure-Python AES-128 (no native crypto deps)</div>
                </div>
              </div>

              {/* V3 live readout — only when a public endpoint is configured */}
              {online && solar && (
                <div className="bg-cyan-50/30 dark:bg-cyan-900/10 rounded-xl px-4 py-3 mb-6 border border-cyan-200 dark:border-cyan-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot online={true} />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      V3 live: {solar.battery_voltage?.toFixed(2)}V ({soc}%) &bull; {solar.solar_power}W solar &bull; {loadW}W load &bull; {solar.charge_state}
                    </span>
                  </div>
                  {weather && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {weather.emoji} {weather.temp}&deg;F
                    </span>
                  )}
                </div>
              )}

              {/* Tech Tags */}
              <div className="flex flex-wrap gap-2 mt-6">
                {[
                  'Rockchip RV1106', 'Custom Kernel (Buildroot)', 'TUN + WireGuard', '1 TOPS NPU',
                  'YOLOv5s INT8', 'H.265 HW Encode', '5MP MIS5001', 'go2rtc WebRTC',
                  'LTE Cat-4 (SIM7600G-H)', 'WiFi 6 Failover', 'Tailscale', 'Victron BLE (AES-128-CTR)',
                  '24/7 Recording', 'Solar Power',
                ].map((tech, i) => (
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
