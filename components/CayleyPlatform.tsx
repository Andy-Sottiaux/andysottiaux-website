'use client'

/**
 * Cayley V3 development platform — single-page experience covering:
 * - Hero with live 3D board (CAD model, hover annotations)
 * - Live system telemetry from /api/health, /api/solar, /api/detections
 * - Camera live-stream link
 * - Boot timeline (interactive)
 * - Six recovery layers (interactive)
 * - Failure-mode coverage matrix
 * - Code tour (key snippets)
 * - Phase 2/3 roadmap
 *
 * Apple-grade polish: typography, spring easing, scroll-triggered reveals,
 * backdrop blur, careful palette, generous whitespace.
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

  const stages = useMemo(() => [
    { t: 't = 0 s', title: 'Boot ROM',
      summary: 'Mask ROM in the SoC reads idblock.',
      detail: 'RV1106’s factory-burned ROM reads idblock (256 KB at offset 32K + 512K) and loads it as the rockchip-signed first-stage bootloader. The only code that runs from non-writable storage.' },
    { t: 't ≈ 0.5 s', title: 'U-Boot',
      summary: 'Reads env partition, applies FDT overlays, loads the kernel.',
      detail: 'Reads env for kernel cmdline + FDT overlays. Where dr_mode, USB_MODE, and panic=10 live. Loads boot.img into RAM, applies overlays, jumps to the kernel entry point.' },
    { t: 't ≈ 3 s', title: 'Linux 5.10.160',
      summary: 'Decompresses, mounts rootfs, brings up busybox init.',
      detail: 'Custom kernel: CONFIG_TUN + CONFIG_WIREGUARD for Tailscale. Phase 1 also adds PANIC_ON_OOPS, HARDLOCKUP/SOFTLOCKUP detectors, ZRAM, kernel-side LED heartbeat, and watchdog NOWAYOUT.' },
    { t: 't ≈ 6 s', title: 'init.d sequence',
      summary: 'Stock Buildroot scripts: udev, networking, dhcpcd, dbus.',
      detail: 'Busybox init runs S01…S98 alphabetically. Our addition: S98zram sets up the 32 MB compressed swap before the cayley layer starts.' },
    { t: 't ≈ 10 s', title: 'S99cayley',
      summary: 'First action: claim the watchdog. Then everything else.',
      detail: 'Starts cayley-extwd, which opens /dev/watchdog. With NOWAYOUT, that’s a hard commitment. Then DNS lockdown, route metrics, SD mount, HTTPS time sync, tailscaled in DERP-only mode, finally cayleyd.' },
    { t: 't ≈ 30 s', title: 'cayleyd lights up the services',
      summary: 'Nine children, supervised, OOM-protected, restart-rate-capped.',
      detail: 'Forks go2rtc, cayley-record, cayley-cleanup, cayley-detect-loop (NPU YOLOv5s), cayley-victron, cayley-solar-api, cayley-net-watchdog, cayley-snapshot, cayley-ledpulse. Crash artifacts ringbuffer to SD card.' },
    { t: 't ≈ 75 s', title: 'Online and serving',
      summary: 'Tailscale connects. Funnel cert provisioned. Heartbeat blinks.',
      detail: 'Tailscale connects via DERP relay. Funnel HTTPS endpoints come up. Camera RTSP active. Detector running. Heartbeat LED double-blinks. Steady state.' },
  ], [])

  const layers = useMemo(() => [
    { n: '01', t: 'Kernel — panic and lockup detection', tag: 'kernel',
      d: 'Phase 1: PANIC_ON_OOPS + panic=10. Any kernel oops auto-reboots in 10 s. Hardlockup and softlockup detectors print stack traces and force panic on stuck CPUs.' },
    { n: '02', t: 'Hardware watchdog — DesignWare WDT', tag: 'SoC',
      d: 'NOWAYOUT means once /dev/watchdog opens, nothing disarms it. If the userspace owner stops petting for 30 s, the SoC resets itself — independent of any software state.' },
    { n: '03', t: 'cayley-extwd — heartbeat watchdog', tag: 'Python',
      d: 'Holds /dev/watchdog open. Pets only while cayleyd’s heartbeat file is fresh. Monotonic-clock cushion so NTP +8 h jumps don’t false-fire.' },
    { n: '04', t: 'cayley-net-watchdog — failover', tag: 'shell',
      d: 'Per-iface TCP probes. Active default-route arbitration. Magicsock wedge detection. Three kicks in 10 min → sysrq reboot. Iface-failover triggers tailscaled rebind.' },
    { n: '05', t: 'cayleyd — supervisor', tag: 'Python',
      d: 'Forks 9 children with PR_SET_PDEATHSIG. Exponential backoff. Restart-rate cap. OOM_score_adj=-500 for self and extwd. Crash artifacts to SD-card ringbuffer.' },
    { n: '06', t: 'cayley-snapshot — flight recorder', tag: 'shell',
      d: 'Boot manifest, 5-min health JSONL, event-log tail to SD card. Survives reboots. 20-session ringbuffer. The forensic record.' },
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
        Cayley V3 · Development Platform
        <a href="/" className="ml-6 text-white/50 hover:text-white transition-colors">← back to andysottiaux</a>
      </nav>

      {/* HERO with 3D board front and center */}
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
            Embedded · Solar · NPU · Edge AI
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
            The board that<br />fixes itself.
          </h1>
          <p className="text-[19px] md:text-[22px] text-white/60 mt-5 max-w-2xl mx-auto leading-snug tracking-tight">
            A Luckfox Pico Pi A W, kernel-hardened, six recovery layers, designed for unattended deployment in places no one is going to drive to.
          </p>

          {/* 3D viewer — front and center */}
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
              Drag to orbit · scroll to zoom · hover any pulsing dot for a component callout
            </p>
          </div>
        </div>
      </header>

      {/* LIVE DASHBOARD */}
      <Section eyebrow="01 — Live" title="From the actual board, right now.">
        <p className="text-[19px] text-white/60 max-w-xl mb-8">
          Every value below is fetched live over Tailscale Funnel. Refreshes every 30 seconds.
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
                <div className="text-white/40 text-sm">Recovery layer is probably mid-cycle. Try in 60–180 s.</div>
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
                  No telemetry yet — board is currently away from the Victron device.
                  <br /><span className="text-white/30 text-[12.5px]">Will populate when board is in BLE range of the SmartSolar.</span>
                </div>
              )}
            </div>

            {/* Detections */}
            <div className="rounded-2xl p-6" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-white/90">NPU Detections (1 h)</div>
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
                    No detections in the last hour.
                    <br /><span className="text-white/30 text-[12.5px]">Privacy-aware: only counts + class names exposed (no bboxes, no frames).</span>
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
              <div className="text-sm font-semibold mb-1">Live camera feed</div>
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
              Open live stream
            </a>
          </div>
        </Reveal>
      </Section>

      {/* BOOT */}
      <Section eyebrow="02 — Boot" title="Off to online in 75 seconds.">
        <p className="text-[19px] text-white/60 max-w-xl mb-8">
          Each stage clickable. Watch the kernel come up, the init scripts run, the watchdog claim its territory, and the supervisor light up nine services in sequence.
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
                      maxHeight: openStage === i ? 280 : 0,
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

      {/* LAYERS */}
      <Section eyebrow="03 — Defense" title="Six independent layers of recovery.">
        <p className="text-[19px] text-white/60 max-w-xl mb-8">
          Each layer covers a different failure class. Layer N&#39;s failure becomes layer N+1&#39;s input. The kernel is the deepest backstop.
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
                  <div className="grid items-center" style={{ gridTemplateColumns: '64px 1fr 100px' }}>
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

      {/* MATRIX */}
      <Section eyebrow="04 — Coverage" title="Sixteen failure modes, mapped.">
        <p className="text-[19px] text-white/60 max-w-xl mb-8">
          Real failure scenarios, what catches each, expected recovery time. The bottom three rows are honest about what&apos;s still out of reach in software.
        </p>
        <Reveal delay={0.05}>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#16161a' }}>
                  <Th>Failure</Th><Th>Caught by</Th><Th>Recovery</Th>
                </tr>
              </thead>
              <tbody>
                <Row f="Service crashes" by="cayleyd" recovery="1–30 s" tone="ok" />
                <Row f="Service crash-loops" by="cayleyd rate cap" recovery="60 s penalty" tone="ok" />
                <Row f="Service OOM-killed" by="cayleyd" recovery="1–30 s" tone="ok" />
                <Row f="cayleyd OOM-killed" by="extwd" recovery="≤ 75 s" tone="ok" />
                <Row f="cayleyd hangs" by="extwd → SoC reset" recovery="≤ 75 s" tone="ok" />
                <Row f="WiFi APIPA stuck" by="net-watchdog" recovery="30–60 s" tone="ok" />
                <Row f="Tailscale LocalAPI hangs" by="net-watchdog" recovery="30–60 s" tone="ok" />
                <Row f="magicsock wedge" by="net-watchdog rx-stall" recovery="~120 s" tone="ok" />
                <Row f="Total network blackout" by="sysrq reboot" recovery="~90 s" tone="ok" />
                <Row f="Kernel oops, half-alive" by="PANIC_ON_OOPS · Phase 1" recovery="10 s" tone="ok" />
                <Row f="CPU hardlocked" by="HARDLOCKUP_DETECTOR · Phase 1" recovery="10–20 s" tone="ok" />
                <Row f="Userspace tight-loop" by="SOFTLOCKUP_DETECTOR · Phase 1" recovery="10–20 s" tone="ok" />
                <Row f="Watchdog disarmed by cleanup" by="NOWAYOUT · Phase 1" recovery="impossible" tone="ok" />
                <Row f="Bad new kernel push" by="Phase 2 needed" recovery="physical reflash" tone="warn" />
                <Row f="Power-loss FS corruption" by="Phase 3 needed" recovery="physical reflash" tone="warn" />
                <Row f="Hardware death" by="no software fix" recovery="replacement" tone="danger" />
              </tbody>
            </table>
          </div>
        </Reveal>
      </Section>

      {/* CODE */}
      <Section eyebrow="05 — Code" title="A few hundred lines that turn a Pico Pi into Cayley.">
        <p className="text-[19px] text-white/60 max-w-xl mb-8">
          The orchestration primitives. Everything else builds on top of these.
        </p>
        <div className="grid gap-4 md:grid-cols-1">
          <Reveal delay={0.05}>
            <CodePanel
              title="S99cayley — boot orchestration"
              sub="First action on boot: claim the watchdog before anything that could block."
              language="sh"
              code={`# /etc/init.d/S99cayley
case "$1" in
  start)
    mkdir -p /var/run/tailscale /dev/net /var/log/cayley /var/run/cayley

    # cayley-extwd FIRST — claim /dev/watchdog before any other
    # step that could block. With NOWAYOUT, the dog can't be disarmed.
    if ! pgrep -f "/usr/local/bin/cayley-extwd" >/dev/null; then
      nohup /usr/local/bin/cayley-extwd \\
        > /var/log/cayley/cayley-extwd.stdout 2>&1 < /dev/null &
    fi

    # Heartbeat LED — try kernel-side trigger first (Phase 1)
    echo heartbeat > /sys/class/leds/work/trigger 2>/dev/null

    # tailscaled in DERP-only mode (CGNAT defeats direct WireGuard)
    TS_DEBUG_DISABLE_DIRECT=true \\
    nohup /userdata/tailscale/tailscaled \\
        --statedir=/userdata/tailscale/state \\
        --port=41641 > /var/log/cayley/tailscaled.log 2>&1 &`}
            />
          </Reveal>
          <Reveal delay={0.1}>
            <CodePanel
              title="cayley-extwd — heartbeat watchdog"
              sub="Pets the dog only while cayleyd's heartbeat is fresh. Monotonic-clock cushion."
              language="py"
              code={`while True:
    age = heartbeat_age()                # time.time() - mtime
    mono = time.monotonic()
    in_grace = (mono - boot_mono) < GRACE_BOOT
    recent_fresh = (mono - last_fresh_mono) < STALE_AFTER

    if age is None:
        healthy = in_grace               # pet during boot grace
    elif age < STALE_AFTER:
        healthy = True
        last_fresh_mono = mono
    elif recent_fresh:
        healthy = True                   # NTP clock jump cushion
    else:
        healthy = in_grace               # withhold → SoC reset

    if healthy:
        os.write(WDT_FD, b"P")
    time.sleep(PET_INTERVAL)`}
            />
          </Reveal>
        </div>
      </Section>

      {/* ROADMAP */}
      <Section eyebrow="06 — Next" title="What's still out of reach.">
        <p className="text-[19px] text-white/60 max-w-xl mb-8">
          Phase 1 closed the kernel-level gap. Two more phases bring genuinely unattended-grade reliability.
        </p>
        <Reveal delay={0.05}>
          <div className="grid md:grid-cols-3 gap-4">
            <RoadmapCard badge="Phase 2 · designed" title="A/B kernel partitions"
              body="Two boot.img slots, U-Boot picks active. New kernel installs to inactive slot in trial mode; if it doesn't mark itself healthy in 5 min, U-Boot rolls back automatically. Eliminates 'bad OTA bricks the board' forever." />
            <RoadmapCard badge="Phase 3 · planned" title="Read-only rootfs + OverlayFS"
              body="Mount / read-only, runtime state in tmpfs/overlay. Power-loss filesystem corruption becomes impossible. Phase 1 already added CONFIG_OVERLAY_FS=y — kernel is ready." />
            <RoadmapCard badge="Hardware" title="Aux antenna + smart relay"
              body="LTE aux for MIMO downlink (~$10) — site has -118 dBm RSRP, biggest practical improvement. 12V smart relay (~$15) for remote power cycle when nothing else can." />
          </div>
        </Reveal>
      </Section>

      {/* DEV TOOLS */}
      <Section eyebrow="07 — Develop" title="Dev surface.">
        <p className="text-[19px] text-white/60 max-w-xl mb-8">
          The repo, the OTA flow, the live endpoints. Everything you need to iterate.
        </p>
        <Reveal delay={0.05}>
          <div className="grid md:grid-cols-2 gap-4">
            <DevCard title="Source" sub="Repository · github" href="https://github.com/Andy-Sottiaux/SolarCamera"
              cmd="git clone https://github.com/Andy-Sottiaux/SolarCamera" />
            <DevCard title="Build firmware" sub="Docker SDK + V3 kernel fragment" href={null}
              cmd={'cd v3/firmware && ./build.sh\n# kernel-only:  ./build.sh kernel'} />
            <DevCard title="OTA package" sub="Versioned tarball with sha256 manifest" href={null}
              cmd="v3/scripts/cayley-package --notes 'release notes here'" />
            <DevCard title="OTA install" sub="Atomic on-board · auto-rollback if /api/health fails" href={null}
              cmd="cayley-update --file /tmp/cayley-update-VERSION.tar.gz\n# or:\ncayley-update --url https://example.com/release.tar.gz" />
            <DevCard title="Pull logs" sub="rsync-resilient, lands in v3/logs/<ts>/" href={null}
              cmd="v3/scripts/cayley-pull-logs" />
            <DevCard title="SSH config" sub="ControlMaster + 5-min keepalive — survives cellular blips" href={null}
              cmd="cat v3/scripts/cayley-ssh-config-snippet >> ~/.ssh/config" />
          </div>
        </Reveal>
      </Section>

      {/* Footer */}
      <footer
        className="text-center py-16 text-white/40 text-[13px]"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>Cayley V3 · open source · self-healing</div>
        <div className="mt-3 text-xs">
          Public APIs: {' '}
          <a className="text-white/60 hover:text-emerald-400 transition-colors" href={SOLAR_URL} target="_blank" rel="noopener noreferrer">/api/solar</a>{' '}·{' '}
          <a className="text-white/60 hover:text-emerald-400 transition-colors" href={HEALTH_URL} target="_blank" rel="noopener noreferrer">/api/health</a>{' '}·{' '}
          <a className="text-white/60 hover:text-emerald-400 transition-colors" href={DETECTIONS_URL} target="_blank" rel="noopener noreferrer">/api/detections</a>
        </div>
      </footer>

      {/* Global keyframes for the platform */}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: '#16161a', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10.5px] uppercase tracking-widest text-white/40 font-medium">{label}</div>
      <div className="text-[22px] font-semibold tracking-tight mt-1 leading-none">{value}</div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-4 text-[11.5px] font-semibold text-white/40 uppercase tracking-widest" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{children}</th>
}

function Row({ f, by, recovery, tone }: { f: string; by: string; recovery: string; tone: 'ok' | 'warn' | 'danger' }) {
  const color = { ok: '#30d158', warn: '#ff9f0a', danger: '#ff453a' }[tone]
  return (
    <tr style={{ transition: 'background 0.2s' }}>
      <td className="px-6 py-3.5 text-[14.5px] font-medium text-white/90" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{f}</td>
      <td className="px-6 py-3.5 text-[14px]" style={{ color, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{by}</td>
      <td className="px-6 py-3.5 text-[14px] text-white/60" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{recovery}</td>
    </tr>
  )
}

function CodePanel({ title, sub, code }: { title: string; sub: string; code: string; language: string }) {
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
