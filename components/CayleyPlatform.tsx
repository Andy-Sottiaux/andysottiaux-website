'use client'

/**
 * Cayley V3 platform — interactive education + live operations dashboard.
 *
 * Tone: exciting, educational. Showcases how the board operates, the
 * pipeline from solar to camera to AI inference to public API. Uses
 * the actual board as the centerpiece, with progressive disclosure on
 * each subsystem.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const BoardViewer = dynamic(() => import('./BoardViewer'), { ssr: false })

const HEALTH_URL = 'https://cayley-v3-cam.tailc7d6b6.ts.net/api/health'
const SOLAR_URL = 'https://cayley-v3-cam.tailc7d6b6.ts.net/api/solar'
const DETECTIONS_URL = 'https://cayley-v3-cam.tailc7d6b6.ts.net/api/detections'
const CAMERA_URL = 'https://cayley-v3-cam.tailc7d6b6.ts.net/'

type Health = {
  ok: boolean
  service_count: number
  services_down: string[]
  supervisor_pid: number
  state_age_s: number
  services: Array<{ name: string; status: string; pid: number; uptime_s: number; restart_count: number }>
}

type Solar = {
  battery_voltage: number | null
  charging_current: number | null
  solar_power: number | null
  yield_today: number | null
  charge_state: string | null
  load_current: number | null
  timestamp: number
  error?: string
}

type Detections = {
  window_sec: number
  now: number
  counts: Record<string, number>
  recent: Array<{ ts: number; class: string; conf: number }>
}

function fmtUptime(s: number): string {
  if (s < 60) return Math.floor(s) + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return (s / 3600).toFixed(1) + 'h'
  return (s / 86400).toFixed(1) + 'd'
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { setShown(true); io.disconnect() }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, shown }
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, shown } = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translate3d(0,0,0)' : 'translate3d(0, 30px, 0)',
        transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

function StatPill({ status }: { status: 'live' | 'fail' | 'loading' }) {
  const cfg = {
    live:    { dot: '#30d158', text: 'live',         bg: 'rgba(48,209,88,0.10)',  border: 'rgba(48,209,88,0.25)',  color: '#30d158' },
    fail:    { dot: '#ff453a', text: 'unreachable',  bg: 'rgba(255,69,58,0.10)',  border: 'rgba(255,69,58,0.25)',  color: '#ff453a' },
    loading: { dot: '#ff9f0a', text: 'fetching…',    bg: 'rgba(255,159,10,0.10)', border: 'rgba(255,159,10,0.25)', color: '#ff9f0a' },
  }[status]
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, letterSpacing: '-0.005em' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}`, animation: status === 'loading' ? 'cayPulse 1.4s cubic-bezier(0.4,0,0.6,1) infinite' : 'none' }} />
      {cfg.text}
    </span>
  )
}

export default function CayleyPlatform() {
  const [health, setHealth] = useState<Health | null>(null)
  const [solar, setSolar] = useState<Solar | null>(null)
  const [detections, setDetections] = useState<Detections | null>(null)
  const [healthState, setHealthState] = useState<'live' | 'fail' | 'loading'>('loading')
  const [openStage, setOpenStage] = useState<number | null>(0)
  const [openLayer, setOpenLayer] = useState<number | null>(null)

  // Polling
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const fetchOne = async <T,>(url: string): Promise<T | null> => {
        try {
          const ctrl = new AbortController()
          const t = setTimeout(() => ctrl.abort(), 8000)
          const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
          clearTimeout(t)
          if (!r.ok) return null
          return (await r.json()) as T
        } catch { return null }
      }
      const [h, s, d] = await Promise.all([
        fetchOne<Health>(HEALTH_URL),
        fetchOne<Solar>(SOLAR_URL),
        fetchOne<Detections>(DETECTIONS_URL),
      ])
      setHealth(h)
      setSolar(s)
      setDetections(d)
      setHealthState(h ? 'live' : 'fail')
      timer = setTimeout(tick, 30_000)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  // Boot timeline as an education narrative
  const stages = useMemo(() => [
    { t: 't = 0 s', title: 'Power on',
      summary: 'The SoC wakes up. A factory-burned ROM begins reading flash.',
      detail: 'Rockchip’s mask ROM — a tiny program physically baked into the silicon — runs first. It reads the idblock partition (256 KB) and verifies it against a Rockchip signature, then loads it as the first-stage bootloader.' },
    { t: 't ≈ 0.5 s', title: 'U-Boot takes over',
      summary: 'A real bootloader, with logic. Reads kernel parameters from flash.',
      detail: 'U-Boot reads the env partition for kernel cmdline + device-tree overlays. This is where things like USB role (peripheral vs host), CMA size, and panic timeout live. It loads boot.img into RAM and jumps to Linux.' },
    { t: 't ≈ 3 s', title: 'Linux 5.10.160 comes up',
      summary: 'Custom-built kernel decompresses, mounts the filesystem.',
      detail: 'Compiled from the Luckfox SDK with our own config fragment: TUN + WireGuard for Tailscale, ZRAM for compressed swap, kernel-side LED heartbeat, hardware-watchdog NOWAYOUT. Built reproducibly via a Docker volume.' },
    { t: 't ≈ 6 s', title: 'Init scripts run',
      summary: 'Buildroot S01…S98 bring up udev, networking, dhcpcd, dbus.',
      detail: 'Standard busybox init reads /etc/inittab, runs /etc/init.d/rcS, which executes everything in alphabetical order. We added S98zram to set up a 32 MB compressed swap before our orchestration starts.' },
    { t: 't ≈ 10 s', title: 'S99cayley orchestrates',
      summary: 'Network bring-up, time sync, Tailscale, then the supervisor.',
      detail: 'DNS lockdown to 1.1.1.1/8.8.8.8, default-route metric tuning so wifi wins over cellular, SD card mount, HTTPS-Date time sync (NTP-blocking-tolerant), tailscaled launch, finally cayleyd.' },
    { t: 't ≈ 30 s', title: 'Nine services light up',
      summary: 'cayleyd forks the application layer.',
      detail: 'go2rtc bridges the camera to WebRTC; cayley-record writes 15-min MP4 segments; cayley-detect-loop runs YOLOv5s on the NPU; cayley-victron decodes Bluetooth solar telemetry; cayley-solar-api serves the public HTTP. All supervised, all OOM-protected.' },
    { t: 't ≈ 75 s', title: 'Online and serving',
      summary: 'Tailscale Funnel certifies. Public APIs respond. Heartbeat pulses.',
      detail: 'A DERP relay handshake, a Let’s-Encrypt certificate via SNI, a kernel heartbeat double-blink. The board is now reachable from anywhere on the internet at https://cayley-v3-cam.tailc7d6b6.ts.net.' },
  ], [])

  // Architecture as components / pipeline (educational, not defensive)
  const layers = useMemo(() => [
    { n: '01', t: 'Camera pipeline · ISP → H.265', tag: 'hardware',
      d: 'A 5 MP MIS5001 sensor feeds the Rockchip ISP, which auto-exposes / white-balances / corrects the image, then hands it to a hardware H.265 encoder. CPU never touches a frame. The result is RTSP at 127.0.0.1:554, ready for streaming or AI.' },
    { n: '02', t: 'NPU inference · YOLOv5s INT8', tag: 'edge AI',
      d: 'A 1 TOPS NPU runs an INT8-quantized YOLOv5s model. ffmpeg pipes 640×640 RGB frames into our cayley_detector binary which does inference at ~12 FPS standalone (5 FPS with the camera/recording stack running concurrently). Detections emit as JSONL.' },
    { n: '03', t: 'Solar telemetry · Bluetooth → AES → JSON', tag: 'IoT',
      d: 'A Victron SmartSolar charge controller broadcasts AES-128-CTR-encrypted telemetry over Bluetooth Instant Readout. cayley-victron scans via bluetoothctl, decodes with a pure-Python AES implementation (no external deps), and writes solar.jsonl.' },
    { n: '04', t: 'Network · WiFi + LTE + Tailscale', tag: 'connectivity',
      d: 'Two physical paths: AIC8800DC WiFi 6 over SDIO, SIM7600G-H LTE Cat-4 over M.2. Tailscale provides a tailnet identity. Funnel exposes selected paths publicly via HTTPS — no port forwarding, no DDNS, no router config.' },
    { n: '05', t: 'Supervisor · cayleyd', tag: 'Python',
      d: 'A small Python supervisor that forks all services, watches them, restarts on exit with exponential backoff and rate caps. Adjusts OOM scores so it stays alive under memory pressure. Writes a health JSON for /api/health.' },
    { n: '06', t: 'Observability · cayley-snapshot', tag: 'shell',
      d: 'Boot manifest + 5-min health JSONL + tail of all service logs, written to SD card every boot. 20-session ringbuffer. The forensic record — survives reboots, makes post-mortems possible without being there live.' },
  ], [])

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}>

      {/* Sticky nav */}
      <nav
        className="sticky top-0 z-50 h-12 flex items-center justify-center text-[13px] text-white/70"
        style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full mr-2"
          style={{ background: '#30d158', animation: 'cayPulse 2s cubic-bezier(0.4,0,0.2,1) infinite' }}
        />
        Cayley V3 · Live Build
        <a href="/" className="ml-6 text-white/50 hover:text-white transition-colors">← back</a>
      </nav>

      {/* HERO */}
      <header
        className="relative overflow-hidden"
        style={{
          padding: '60px 22px 40px',
          background:
            'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(48,209,88,0.10), transparent 70%),' +
            'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(10,132,255,0.06), transparent 70%)',
        }}
      >
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Solar · Edge AI · Autonomous
          </div>
          <h1
            className="font-bold leading-[1.04] tracking-tight"
            style={{
              fontSize: 'clamp(44px, 7vw, 80px)',
              background: 'linear-gradient(180deg, #fff 0%, #b0b0b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Sun goes in.<br />Vision comes out.
          </h1>
          <p className="text-[19px] md:text-[22px] text-white/60 mt-5 max-w-2xl mx-auto leading-snug tracking-tight">
            A solar-powered Linux board with a 5 MP camera, an on-chip neural engine, and a live public API. Built end-to-end. Open source. Explore every layer.
          </p>

          {/* 3D viewer */}
          <div className="mt-12 mx-auto" style={{ maxWidth: 880, aspectRatio: '1.5', position: 'relative' }}>
            <div
              className="relative w-full h-full rounded-[24px] overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(48,209,88,0.06), transparent),' +
                  'linear-gradient(180deg, #0a0a0c 0%, #050507 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <BoardViewer />
            </div>
            <p className="text-white/40 text-[13px] mt-4">
              Drag to orbit · scroll to zoom · hover any pulsing dot to learn what it does
            </p>
          </div>

          {/* Quick-stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12 max-w-3xl mx-auto">
            <QuickStat top="1 TOPS" mid="NPU" sub="on-chip neural engine" />
            <QuickStat top="5 MP" mid="camera" sub="hardware H.265 encoder" />
            <QuickStat top="2 paths" mid="WiFi + LTE" sub="dual-network failover" />
            <QuickStat top="100%" mid="open source" sub="kernel to dashboard" />
          </div>
        </div>
      </header>

      {/* PIPELINE — visual story of how data flows */}
      <Section eyebrow="01 — The Pipeline" title="From photons to public API.">
        <p className="text-[19px] text-white/60 max-w-2xl mb-12">
          Every byte that reaches the dashboard above starts as a photon hitting the sensor or a Bluetooth packet from the solar charger. Here&apos;s the whole journey.
        </p>
        <Reveal delay={0.05}>
          <div className="grid md:grid-cols-2 gap-4">
            <PipelineCard
              icon="📷"
              step="Camera → AI"
              flow="Sensor → ISP → H.265 → ffmpeg → NPU YOLO → JSONL"
              detail="Photons hit the MIS5001 sensor. Hardware ISP corrects exposure and color. The H.265 encoder compresses without touching the CPU. ffmpeg pipes 640×640 RGB frames to a quantized YOLOv5s on the NPU. Detection events stream to disk and to the public /api/detections endpoint — privacy-aware, counts only, no images leave the board."
            />
            <PipelineCard
              icon="☀️"
              step="Solar → Telemetry"
              flow="Victron BLE → AES-128 decode → JSONL → /api/solar"
              detail="The Victron SmartSolar charger broadcasts encrypted telemetry over Bluetooth roughly every second. cayley-victron decodes it with pure-Python AES (no external deps), parses the SmartSolar binary record format, and writes JSONL. The HTTP API exposes the most recent reading at /api/solar."
            />
            <PipelineCard
              icon="📡"
              step="Network → Public"
              flow="WiFi + LTE → Tailscale → DERP → Funnel → HTTPS"
              detail="Two independent network paths — WiFi 6 on SDIO and LTE Cat-4 on M.2. Tailscale provides identity and Funnel routes traffic through their HTTPS edge. No port forwarding, no DDNS, no router config. The board is reachable from any browser at a fixed URL."
            />
            <PipelineCard
              icon="🎬"
              step="Storage → Replay"
              flow="rkipc RTSP → ffmpeg segment → 15-min MP4 → SD card"
              detail="A second ffmpeg process pulls the H.265 stream from the local rkipc service and writes 15-minute MP4 segments to SD card without re-encoding. With a 32 GB SD card, that&apos;s ~22-30 hours of rolling footage. cayley-cleanup auto-evicts the oldest segments when the card hits 85%."
            />
          </div>
        </Reveal>
      </Section>

      {/* LIVE — read live values */}
      <Section eyebrow="02 — Live" title="See it now.">
        <p className="text-[19px] text-white/60 max-w-2xl mb-8">
          Every value below is fetched from the actual board as you read this. Updates every 30 seconds.
        </p>
        <Reveal delay={0.05}>
          <div className="grid md:grid-cols-3 gap-4">
            {/* System health */}
            <div className="rounded-2xl p-6" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-white/90">System</div>
                <StatPill status={healthState} />
              </div>
              {health ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Services" value={String(health.service_count)} />
                    <Stat label="Down" value={String(health.services_down.length)} />
                    <Stat label="Supervisor" value={'pid ' + health.supervisor_pid} />
                    <Stat label="State age" value={health.state_age_s.toFixed(1) + 's'} />
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-1">
                    {health.services.map((s) => (
                      <div key={s.name} className="flex items-center gap-2 text-[12.5px] text-white/80 py-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: s.status === 'running' ? '#30d158' : '#ff453a', boxShadow: '0 0 6px ' + (s.status === 'running' ? '#30d158' : '#ff453a') }}
                        />
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-auto text-white/40 font-mono text-[11px]">{fmtUptime(s.uptime_s)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-white/40 text-sm">Live readout will appear when the board is reachable.</div>
              )}
            </div>

            {/* Solar */}
            <div className="rounded-2xl p-6" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-white/90">Solar (Victron)</div>
                <StatPill status={solar?.battery_voltage != null ? 'live' : (solar?.error ? 'loading' : healthState)} />
              </div>
              {solar?.battery_voltage != null ? (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Battery" value={`${solar.battery_voltage?.toFixed(2)} V`} />
                  <Stat label="Solar" value={`${solar.solar_power} W`} />
                  <Stat label="Yield today" value={`${(solar.yield_today ?? 0)} Wh`} />
                  <Stat label="State" value={String(solar.charge_state ?? '—')} />
                </div>
              ) : (
                <div className="text-white/40 text-sm leading-relaxed">
                  Telemetry populates when the board is in Bluetooth range of the SmartSolar.
                </div>
              )}
            </div>

            {/* Detections */}
            <div className="rounded-2xl p-6" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-white/90">Detections (1 h)</div>
                <StatPill status={detections ? 'live' : healthState} />
              </div>
              {detections ? (
                Object.keys(detections.counts).length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(detections.counts).slice(0, 4).map(([k, v]) => (
                        <Stat key={k} label={k} value={String(v)} />
                      ))}
                    </div>
                    <div className="mt-4 max-h-32 overflow-y-auto space-y-1">
                      {detections.recent.slice(0, 8).map((r, i) => (
                        <div key={i} className="text-[12px] text-white/60 flex justify-between">
                          <span className="font-medium text-white/80">{r.class}</span>
                          <span className="text-white/40">conf {r.conf}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-white/40 text-sm leading-relaxed">
                    No detections in the last hour. Privacy-aware: only counts + class names exposed.
                  </div>
                )
              ) : (
                <div className="text-white/40 text-sm">—</div>
              )}
            </div>
          </div>
        </Reveal>

        {/* Camera CTA */}
        <Reveal delay={0.1}>
          <div className="mt-6 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-5"
               style={{ background: 'linear-gradient(135deg, rgba(10,132,255,0.08) 0%, rgba(48,209,88,0.06) 100%)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div>
              <div className="text-sm font-semibold mb-1">Live camera</div>
              <div className="text-white/60 text-[14px] leading-snug">5 MP H.265 streamed via WebRTC over Tailscale Funnel — public HTTPS endpoint, latency &lt; 1 s in good conditions.</div>
            </div>
            <a
              href={CAMERA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-transform"
              style={{ background: 'rgba(255,255,255,0.95)', color: '#000', minWidth: 160, justifyContent: 'center' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Open the stream
            </a>
          </div>
        </Reveal>
      </Section>

      {/* BOOT — story of how it comes alive */}
      <Section eyebrow="03 — Boot" title="Watch it come alive.">
        <p className="text-[19px] text-white/60 max-w-2xl mb-8">
          From a cold ROM to a full edge-AI server in seventy-five seconds. Each stage is a different layer of the system claiming its job. Click any to expand.
        </p>
        <Reveal delay={0.05}>
          <div>
            {stages.map((s, i) => (
              <div
                key={i}
                className="grid items-start cursor-pointer transition-all"
                style={{
                  gridTemplateColumns: 'minmax(80px, 110px) 1fr',
                  gap: 32,
                  padding: '22px 0',
                  borderTop: '1px solid rgba(255,255,255,' + (i === 0 ? '0.14' : '0.08') + ')',
                  paddingLeft: openStage === i ? 8 : 0,
                  transition: 'padding 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onClick={() => setOpenStage(openStage === i ? null : i)}
              >
                <div className="text-emerald-400 font-mono text-sm font-semibold tracking-tight">{s.t}</div>
                <div>
                  <div className="text-[20px] md:text-[22px] font-semibold tracking-tight flex items-center gap-2">
                    {s.title}
                    <span className="text-white/40 text-[14px] transition-transform" style={{ transform: openStage === i ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                  </div>
                  <div className="text-white/60 text-[15px] mt-1 leading-relaxed">{s.summary}</div>
                  <div
                    style={{
                      maxHeight: openStage === i ? 320 : 0,
                      opacity: openStage === i ? 1 : 0,
                      overflow: 'hidden',
                      marginTop: openStage === i ? 14 : 0,
                      transition: 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s, margin-top 0.4s',
                    }}
                  >
                    <div className="text-white/70 text-[14.5px] leading-relaxed">{s.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* ARCHITECTURE — six subsystems */}
      <Section eyebrow="04 — Architecture" title="Six subsystems, one board.">
        <p className="text-[19px] text-white/60 max-w-2xl mb-8">
          Each subsystem is independently developed, supervised, and observable. The whole greater than the sum.
        </p>
        <Reveal delay={0.05}>
          <div className="grid gap-2">
            {layers.map((l, i) => {
              const open = openLayer === i
              return (
                <div
                  key={i}
                  className="rounded-2xl cursor-pointer transition-all"
                  style={{
                    background: open ? 'linear-gradient(180deg, rgba(48,209,88,0.05), transparent), #16161a' : '#0a0a0c',
                    border: '1px solid ' + (open ? '#30d158' : 'rgba(255,255,255,0.08)'),
                    boxShadow: open ? '0 0 0 1px #30d158, 0 24px 60px rgba(48,209,88,0.08)' : 'none',
                    padding: '22px 26px',
                    transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onClick={() => setOpenLayer(open ? null : i)}
                >
                  <div className="grid items-center" style={{ gridTemplateColumns: '64px 1fr 110px' }}>
                    <div className="text-3xl font-light tracking-tighter" style={{ color: open ? '#30d158' : '#6e6e73', fontWeight: open ? 600 : 200, transition: 'all 0.4s' }}>{l.n}</div>
                    <div className="text-[17px] font-medium tracking-tight">{l.t}</div>
                    <div className="text-right text-[11px] font-medium uppercase tracking-widest text-white/40">{l.tag}</div>
                  </div>
                  <div
                    style={{
                      maxHeight: open ? 320 : 0,
                      opacity: open ? 1 : 0,
                      overflow: 'hidden',
                      marginTop: open ? 16 : 0,
                      transition: 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s, margin-top 0.4s',
                    }}
                  >
                    <div className="grid" style={{ gridTemplateColumns: '64px 1fr' }}>
                      <div />
                      <div className="text-white/70 text-[15px] leading-relaxed pr-4">{l.d}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>
      </Section>

      {/* CODE */}
      <Section eyebrow="05 — Code" title="A few hundred lines that turn a Pico Pi into Cayley.">
        <p className="text-[19px] text-white/60 max-w-2xl mb-8">
          The orchestration primitives. Everything else builds on these.
        </p>
        <div className="grid gap-4">
          <Reveal delay={0.05}>
            <CodePanel
              title="S99cayley — boot orchestration"
              sub="The first script we get to run. Sets up everything the supervisor needs."
              code={`# /etc/init.d/S99cayley
case "$1" in
  start)
    mkdir -p /var/run/tailscale /dev/net /var/log/cayley /var/run/cayley

    # Heartbeat LED — kernel-side trigger if available
    echo heartbeat > /sys/class/leds/work/trigger 2>/dev/null

    # Sync the clock — HTTPS Date-header tolerant of NTP-blocking networks
    /usr/local/bin/timesync >/var/log/cayley/timesync.log 2>&1

    # Tailscale daemon — DERP-only mode keeps the path stable on cellular
    TS_DEBUG_DISABLE_DIRECT=true \\
    nohup /userdata/tailscale/tailscaled \\
        --statedir=/userdata/tailscale/state \\
        --port=41641 > /var/log/cayley/tailscaled.log 2>&1 &

    # The supervisor — owns go2rtc, recorder, NPU detector, victron, …
    nohup /usr/bin/python3 -u /usr/local/bin/cayleyd \\
        > /var/log/cayley/cayleyd.stderr 2>&1 < /dev/null &
    ;;
esac`}
            />
          </Reveal>
          <Reveal delay={0.1}>
            <CodePanel
              title="cayley-victron — pure-Python AES-128 BLE decoder"
              sub="Decrypts Victron Instant Readout broadcasts with zero external dependencies."
              code={`def parse_advertisement(data: bytes, key: bytes) -> dict:
    if len(data) < 8 or data[:2] != b"\\x10\\x02":
        return {}
    iv = data[5:7]                           # 16-bit IV
    ct = data[7:]                            # ciphertext

    # AES-128-CTR with the IV in low 16 bits, counter in high 4 bytes
    nonce = iv + b"\\x00" * 12 + b"\\x00" * 2
    pt = aes_ctr_decrypt(ct, key, nonce)

    return {
        "battery_v":    int.from_bytes(pt[2:4],  "little") / 100.0,
        "solar_w":      int.from_bytes(pt[4:6],  "little"),
        "yield_today":  int.from_bytes(pt[6:8],  "little") * 10,
        "charge_state": ["off","fault","bulk","absorb","float"][pt[0]],
    }`}
            />
          </Reveal>
        </div>
      </Section>

      {/* DEV TOOLS */}
      <Section eyebrow="06 — Develop" title="Build it yourself.">
        <p className="text-[19px] text-white/60 max-w-2xl mb-8">
          The whole stack is open source. Clone, build, deploy, observe. Each command below is one of the steps in our daily workflow.
        </p>
        <Reveal delay={0.05}>
          <div className="grid md:grid-cols-2 gap-4">
            <DevCard title="Source" sub="Repository · github" href="https://github.com/Andy-Sottiaux/SolarCamera"
              cmd="git clone https://github.com/Andy-Sottiaux/SolarCamera" />
            <DevCard title="Build firmware" sub="Reproducible Docker SDK build" href={null}
              cmd={'cd v3/firmware && ./build.sh\n# kernel-only:  ./build.sh kernel'} />
            <DevCard title="OTA package" sub="Versioned tarball with sha256 manifest" href={null}
              cmd="v3/scripts/cayley-package --notes 'release notes here'" />
            <DevCard title="OTA install" sub="Atomic on-board · auto-rollback if /api/health regresses" href={null}
              cmd="cayley-update --file /tmp/cayley-update-VERSION.tar.gz\n# or:\ncayley-update --url https://example.com/release.tar.gz" />
            <DevCard title="Pull logs" sub="rsync-resilient, lands in v3/logs/<ts>/" href={null}
              cmd="v3/scripts/cayley-pull-logs" />
            <DevCard title="SSH config" sub="ControlMaster + 5-min keepalive over Tailscale" href={null}
              cmd="cat v3/scripts/cayley-ssh-config-snippet >> ~/.ssh/config" />
          </div>
        </Reveal>
      </Section>

      {/* WHY IT MATTERS */}
      <Section eyebrow="07 — Why" title="Edge AI without a cloud.">
        <p className="text-[19px] text-white/60 max-w-2xl mb-8">
          Cayley runs entirely off-grid. No cloud subscription, no monthly fees, no data leaving the property unless you explicitly publish it. A single 30 W solar panel keeps it running 24/7.
        </p>
        <Reveal delay={0.05}>
          <div className="grid md:grid-cols-3 gap-4">
            <RoadmapCard badge="Privacy" title="Frames never leave"
              body="The NPU processes every frame locally. Only counts and class names ever cross the network. No image upload to any third-party API." />
            <RoadmapCard badge="Cost" title="$0 / month operating"
              body="Solar panel powers the board. Tailscale Funnel handles HTTPS for free. Open-source software stack. Total recurring cost: zero." />
            <RoadmapCard badge="Open" title="100% inspectable"
              body="Every line of code, every kernel config, every init script is in the public repo. Fork it, learn from it, deploy your own." />
          </div>
        </Reveal>
      </Section>

      {/* Footer */}
      <footer
        className="text-center py-16 text-white/40 text-[13px]"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>Cayley V3 · open source · solar-powered edge AI</div>
        <div className="mt-3 text-xs">
          Public APIs:{' '}
          <a className="text-white/60 hover:text-emerald-400 transition-colors" href={SOLAR_URL} target="_blank" rel="noopener noreferrer">/api/solar</a>{' '}·{' '}
          <a className="text-white/60 hover:text-emerald-400 transition-colors" href={HEALTH_URL} target="_blank" rel="noopener noreferrer">/api/health</a>{' '}·{' '}
          <a className="text-white/60 hover:text-emerald-400 transition-colors" href={DETECTIONS_URL} target="_blank" rel="noopener noreferrer">/api/detections</a>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes cayPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(48,209,88,0.45); }
          50%      { box-shadow: 0 0 0 8px rgba(48,209,88,0); }
        }
      `}</style>
    </main>
  )
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="py-24 px-6 md:py-32" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-emerald-400 text-[13px] font-semibold uppercase tracking-widest mb-4">{eyebrow}</div>
        </Reveal>
        <Reveal delay={0.05}>
          <h2
            className="font-bold tracking-tight leading-[1.08] mb-6"
            style={{
              fontSize: 'clamp(32px, 4.6vw, 48px)',
              background: 'linear-gradient(180deg, #fff, #b0b0b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {title}
          </h2>
        </Reveal>
        {children}
      </div>
    </section>
  )
}

function QuickStat({ top, mid, sub }: { top: string; mid: string; sub: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-[28px] font-semibold leading-none tracking-tight"
        style={{ background: 'linear-gradient(180deg, #fff, #b0b0b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
      >{top}</div>
      <div className="text-emerald-400 text-[11px] font-semibold uppercase tracking-widest mt-1.5">{mid}</div>
      <div className="text-white/45 text-[12px] mt-1 leading-tight">{sub}</div>
    </div>
  )
}

function PipelineCard({ icon, step, flow, detail }: { icon: string; step: string; flow: string; detail: string }) {
  return (
    <div className="rounded-2xl p-7" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-emerald-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5">{step}</div>
      <div className="text-[14px] font-mono text-white/80 mb-4 leading-relaxed">{flow}</div>
      <p className="text-white/60 text-[14.5px] leading-relaxed">{detail}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: '#16161a', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10.5px] uppercase tracking-widest text-white/40 font-medium">{label}</div>
      <div className="text-[22px] font-semibold tracking-tight mt-1 leading-none">{value}</div>
    </div>
  )
}

function CodePanel({ title, sub, code }: { title: string; sub: string; code: string }) {
  return (
    <div className="rounded-2xl p-7" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 className="text-[17px] font-semibold tracking-tight mb-1.5">{title}</h3>
      <p className="text-[13px] text-white/40 mb-4">{sub}</p>
      <pre
        className="overflow-x-auto rounded-xl text-[13px] leading-relaxed"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '18px 22px',
          fontFamily: '"SF Mono", ui-monospace, monospace',
          color: 'rgba(255,255,255,0.85)',
        }}
      >{code}</pre>
    </div>
  )
}

function RoadmapCard({ badge, title, body }: { badge: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl p-6 transition-transform hover:-translate-y-1" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="inline-block text-[11px] font-medium px-2.5 py-1 rounded-md mb-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>{badge}</div>
      <h3 className="text-[19px] font-semibold tracking-tight mb-2.5">{title}</h3>
      <p className="text-[14.5px] text-white/60 leading-relaxed">{body}</p>
    </div>
  )
}

function DevCard({ title, sub, href, cmd }: { title: string; sub: string; href: string | null; cmd: string }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight">{title}</h3>
          <p className="text-[12.5px] text-white/40 mt-0.5">{sub}</p>
        </div>
        {href && (
          <a className="text-[12px] text-emerald-400 hover:underline" href={href} target="_blank" rel="noopener noreferrer">open ↗</a>
        )}
      </div>
      <pre
        className="text-[12px] rounded-lg p-3 overflow-x-auto"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: '"SF Mono", ui-monospace, monospace', color: 'rgba(255,255,255,0.85)' }}
      >{cmd}</pre>
    </div>
  )
}
