'use client'

/**
 * CompactPortfolio — single-viewport bento alternative to the scrolling
 * home page. Lives at /compact for side-by-side evaluation.
 *
 * Design synthesis (research notes):
 *   - leerob.com / brittanychiang.com / rauno.me / maggieappleton.com all
 *     prefer low-density, single-column scrolling layouts with generous
 *     whitespace. That's the OPPOSITE of what this brief asks for, but the
 *     useful lesson is restraint: don't pack tiles with bullets, let one
 *     headline carry each tile.
 *   - Apple's Vision Pro page sets the cinematic-dark-mode tone — gradient
 *     ambient backgrounds, big SF-like type, generous radii.
 *   - Vercel's homepage demonstrates that asymmetry (different tile aspect
 *     ratios within a single grid) is what makes a "bento" actually feel
 *     like bento rather than a regular grid.
 *
 * Pattern chosen: ASYMMETRIC BENTO with the Field Live cards (Solar /
 * Camera / Health) as the dominant first row. Identity, experience,
 * projects, marathon, contact are supporting tiles arranged so the row
 * heights vary and the eye lands on the camera tile first.
 *
 * Layout (1440×900 desktop, ~85vh of bento):
 *   ┌────────────┬─────────────────────────┬────────────┐
 *   │ identity   │ camera (16:9 hero)      │ solar      │
 *   ├────────────┴─────────────────────────┤            │
 *   │ experience          │ health         │            │
 *   ├─────────────────────┴────────────────┴────────────┤
 *   │ projects     │ marathon      │ contact            │
 *   └──────────────┴───────────────┴────────────────────┘
 *
 * Mobile: stacks vertically (allowed by the brief). All Field Live cards
 * keep polling the same `/api/v3/*` proxies as on the home page.
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import FieldSolarCard from './FieldSolarCard'
import FieldHealthCard from './FieldHealthCard'
import { FieldThemeProvider, useFieldTheme } from './fieldTheme'
import ThemeToggle from './ThemeToggle'

// Same dynamic import the home page uses — the camera feed polls a
// browser-side proxy, so SSR'ing it is wasted work.
const FieldCameraFeed = dynamic(() => import('./FieldCameraFeed'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black/80" />,
})

export default function CompactPortfolio() {
  return (
    <FieldThemeProvider>
      <CompactInner />
    </FieldThemeProvider>
  )
}

function CompactInner() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <main
      className="min-h-screen w-full flex flex-col"
      style={{
        background: palette.sectionBackground,
        color: isLight ? '#1c1a1c' : '#fff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <CompactHeader />

      {/* Bento — vertically centers on tall viewports, fills naturally on
          short ones. Uses minmax(0,1fr) so children can shrink below
          intrinsic content size and the grid honors row heights. */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 pb-6 md:pb-8">
        <div className="w-full max-w-[1380px] mx-auto">
          <Bento />
        </div>
      </div>
    </main>
  )
}

/* ─────────────────────────── Header ─────────────────────────── */

function CompactHeader() {
  // Thin header — the home page's <Header/> is fixed and ~64px tall with a
  // ken-burns hero behind it. /compact has no hero image, so we render an
  // inline, transparent header that doesn't reserve the same vertical real
  // estate.
  return (
    <header className="w-full px-4 sm:px-6 md:px-8 pt-4 md:pt-5">
      <div className="max-w-[1380px] mx-auto flex items-center justify-between">
        <a href="/" className="text-sm font-semibold tracking-tight opacity-80 hover:opacity-100 transition-opacity">
          Andy Sottiaux
        </a>
        <ThemeToggle />
      </div>
    </header>
  )
}

/* ─────────────────────────── Bento ──────────────────────────── */

function Bento() {
  // grid-template-areas keeps the layout legible. Heights are weighted so
  // the camera (the most visually arresting tile) gets the most room.
  return (
    <div
      className="grid gap-3 md:gap-4 mt-4 md:mt-5"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridAutoRows: 'minmax(0, auto)',
      }}
    >
      {/* Row 1: identity (3 cols) · camera (6 cols) · solar (3 cols) */}
      <div className="col-span-12 md:col-span-3"><IdentityTile /></div>
      <div className="col-span-12 md:col-span-6"><CameraTile /></div>
      <div className="col-span-12 md:col-span-3 md:row-span-2"><SolarTile /></div>

      {/* Row 2: experience (5 cols) · health (4 cols) · solar tile already
          spans into this row */}
      <div className="col-span-12 md:col-span-5"><ExperienceTile /></div>
      <div className="col-span-12 md:col-span-4"><HealthTile /></div>

      {/* Row 3: projects (5 cols) · marathon (4 cols) · contact (3 cols) */}
      <div className="col-span-12 md:col-span-5"><ProjectsTile /></div>
      <div className="col-span-12 md:col-span-4"><MarathonTile /></div>
      <div className="col-span-12 md:col-span-3"><ContactTile /></div>
    </div>
  )
}

/* ───────────────────── Tile chrome ──────────────────────── */

function Tile({
  children,
  className = '',
  accent,
  label,
  deepLink,
}: {
  children: React.ReactNode
  className?: string
  /** small uppercase eyebrow color (passed to label) */
  accent?: { light: string; dark: string }
  label?: string
  /** when provided, the whole tile becomes a clickable link to that
   *  fragment on the full home page (e.g. "/#now"). Internal interactive
   *  elements (anchors / buttons) take precedence via z-index so the
   *  whole-tile click only fires on empty space. */
  deepLink?: string
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const accentColor = accent
    ? isLight
      ? accent.light
      : accent.dark
    : undefined

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden h-full flex flex-col ${className}`}
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: palette.cardShadow,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Whole-tile deep link — sits behind interactive content so explicit
          inner <a>s and <button>s win the click. Visit `/#section` on the
          home page when the tile body (not an inner control) is clicked. */}
      {deepLink && (
        <a
          href={deepLink}
          aria-label={label ? `Open ${label} on the full site` : 'Open on the full site'}
          className="absolute inset-0 z-0"
        />
      )}
      {label && (
        <div
          className="relative z-10 px-5 md:px-6 pt-4 md:pt-5 text-[10px] font-semibold uppercase tracking-[0.22em] flex items-center justify-between pointer-events-none"
          style={{ color: accentColor ?? palette.mutedText }}
        >
          <span>{label}</span>
          {deepLink && (
            <svg
              className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M7 17L17 7M9 7h8v8" />
            </svg>
          )}
        </div>
      )}
      {/* Content sits above the deep-link layer so its own anchors/buttons
          capture clicks first. */}
      <div className="relative z-10 flex flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}

/* ───────────────────── Identity tile ──────────────────────── */

function IdentityTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile deepLink="/#about" className="min-h-[170px] md:min-h-[270px]">
      <div className="flex-1 flex flex-col px-5 md:px-6 py-5">
        {/* Hero portrait — much bigger now. Square with a subtle ring + an
            ambient color glow that picks up the ambient palette accent. */}
        <div className="flex justify-center mb-4">
          <div
            className="relative w-[120px] h-[120px] md:w-[140px] md:h-[140px] rounded-2xl overflow-hidden"
            style={{
              boxShadow: isLight
                ? '0 12px 32px rgba(28,26,28,0.18), 0 0 0 1px rgba(0,0,0,0.05)'
                : '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <Image
              src="/images/profile.jpg"
              alt="Andy Sottiaux"
              fill
              sizes="(max-width: 768px) 120px, 140px"
              className="object-cover"
              priority
            />
          </div>
        </div>

        <div
          className="text-center text-[20px] md:text-[22px] font-semibold leading-tight tracking-tight"
          style={{
            backgroundImage: palette.headlineGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Andy Sottiaux
        </div>
        <div
          className="text-center text-[11.5px] md:text-[12px] uppercase tracking-[0.16em] mt-1"
          style={{ color: palette.mutedText }}
        >
          Dallas, TX
        </div>

        <div
          className="text-center text-[12.5px] md:text-[13px] leading-snug tracking-tight mt-3 px-1"
          style={{ color: palette.bodyText }}
        >
          Aerospace hardware · Production software
        </div>

        <div className="mt-auto pt-4 flex justify-center">
          <a
            href="mailto:andrewsottiaux@gmail.com"
            className="relative z-10 inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-tight hover:gap-2 transition-all px-3 py-1.5 rounded-full"
            style={{
              color: isLight ? '#0a8aa8' : 'rgb(103, 232, 249)',
              background: isLight
                ? 'rgba(10, 138, 168, 0.08)'
                : 'rgba(103, 232, 249, 0.08)',
            }}
          >
            Get in touch
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </Tile>
  )
}

/* ───────────────────── Camera tile ──────────────────────── */

function CameraTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Camera"
      accent={{ light: '#0a8aa8', dark: 'rgba(103, 232, 249, 0.9)' }}
      deepLink="/#now"
      className="min-h-[170px] md:min-h-[270px]"
    >
      <div className="px-3 md:px-4 pt-2 md:pt-3 pb-3 md:pb-4 flex-1 flex flex-col">
        <div
          className="relative w-full overflow-hidden rounded-[12px] flex-1"
          style={{
            aspectRatio: '16 / 9',
            background: isLight ? '#0a0a0c' : '#000',
            boxShadow: isLight
              ? '0 4px 12px rgba(28,26,28,0.12)'
              : '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <FieldCameraFeed />
        </div>
        <div
          className="text-[12px] tracking-tight leading-snug mt-2.5 px-1"
          style={{ color: palette.bodyText }}
        >
          Live edge-AI camera. Public read-only stream.
        </div>
      </div>
    </Tile>
  )
}

/* ───────────────────── Solar tile ──────────────────────── */

function SolarTile() {
  // FieldSolarCard already brings its own chrome. Wrapped in an anchor so
  // a click on the card body deep-links to the same section on the home
  // page; the card is read-only so no internal click conflicts.
  return (
    <a
      href="/#now"
      aria-label="Open Field Live on the full site"
      className="block h-full min-h-[360px] md:min-h-[558px] [&>div]:h-full hover:scale-[1.005] transition-transform duration-300"
    >
      <FieldSolarCard />
    </a>
  )
}

/* ───────────────────── Health tile ──────────────────────── */

function HealthTile() {
  return (
    <a
      href="/#now"
      aria-label="Open Field Live on the full site"
      className="block h-full min-h-[260px] md:min-h-[270px] [&>div]:h-full hover:scale-[1.005] transition-transform duration-300"
    >
      <FieldHealthCard />
    </a>
  )
}

/* ───────────────────── Experience tile ──────────────────────── */

const EXPERIENCE = [
  { title: 'Senior Engineer', company: 'AVX Aircraft', period: 'Sep 2023 — Present', url: 'https://www.avxaircraft.com/', current: true },
  { title: 'Founder', company: 'HatchingPoint', period: '2021 — Present', url: 'https://www.hatchingpoint.com' },
  { title: 'Rotor Systems', company: 'Bell Flight', period: '2020 — 2023', url: 'https://www.bellflight.com' },
  { title: 'Project Manager', company: 'Texas Air Systems', period: '2016 — 2020', url: 'https://www.texasairsystems.com/' },
]

function ExperienceTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Experience"
      accent={{ light: '#0f9d4f', dark: 'rgb(74 222 128 / 0.9)' }}
      deepLink="/#experience"
      className="min-h-[200px] md:min-h-[280px]"
    >
      <div className="px-5 md:px-6 pt-3 pb-4 md:pb-5 flex-1 flex flex-col">
        <div className="space-y-2 md:space-y-2.5">
          {EXPERIENCE.map((e) => (
            <a
              key={e.company}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 group flex items-baseline justify-between gap-3 py-1.5 border-b last:border-b-0"
              style={{ borderColor: palette.hairline }}
            >
              <div className="flex items-baseline gap-2 min-w-0 flex-1">
                {e.current && (
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 translate-y-[-1px]"
                    style={{
                      background: '#30d158',
                      boxShadow: '0 0 6px rgba(48,209,88,0.7)',
                    }}
                    aria-hidden="true"
                  />
                )}
                <span
                  className="text-[13px] md:text-[14px] font-semibold tracking-tight truncate"
                  style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                >
                  {e.company}
                </span>
                <span
                  className="text-[12px] md:text-[13px] tracking-tight truncate"
                  style={{ color: palette.bodyText }}
                >
                  {e.title}
                </span>
              </div>
              <span
                className="text-[11px] md:text-[12px] tabular-nums tracking-tight flex-shrink-0 group-hover:opacity-100 opacity-80 transition-opacity"
                style={{ color: palette.mutedText }}
              >
                {e.period}
              </span>
            </a>
          ))}
        </div>
        <div
          className="mt-auto pt-3 text-[10px] tracking-wide italic"
          style={{ color: palette.fadedText }}
        >
          B.S. Mechanical Engineering · Texas Tech, 2016
        </div>
      </div>
    </Tile>
  )
}

/* ───────────────────── Projects tile ──────────────────────── */

const PROJECTS = [
  { name: 'WYZECAR', desc: 'Vision-based autonomous RC car · YOLOv8 · ROS2', url: 'https://github.com/Andy-Sottiaux/WYZECAR', icon: '/images/wyzecar.png', round: true },
  { name: 'Rot Dot', desc: 'NFC-tap app blocker · iOS · Screen Time API', url: 'https://apps.apple.com/us/app/rot-dot/id6758902103', icon: '/images/rotdot-icon.png' },
  { name: 'Record + Transcribe', desc: 'Voice notes with AI summary · iOS', url: 'https://apps.apple.com/app/record-transcribe/id6758643630', icon: '/images/recordtranscribe-icon.png' },
]

function ProjectsTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Projects"
      accent={{ light: '#b45309', dark: 'rgba(252, 211, 77, 0.9)' }}
      deepLink="/#projects"
      className="min-h-[180px] md:min-h-[210px]"
    >
      <div className="px-5 md:px-6 pt-3 pb-4 md:pb-5 flex-1 flex flex-col">
        <div className="space-y-2 md:space-y-2.5 flex-1">
          {PROJECTS.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 group flex items-center gap-3 py-1"
            >
              <div
                className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"
                style={{
                  border: palette.cardBorder,
                  background: isLight ? '#fff' : 'rgba(255,255,255,0.04)',
                }}
              >
                <Image
                  src={p.icon}
                  alt=""
                  width={36}
                  height={36}
                  className={`w-full h-full ${p.round ? 'object-contain p-0.5' : 'object-cover'}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] md:text-[14px] font-semibold tracking-tight"
                  style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                >
                  {p.name}
                </div>
                <div
                  className="text-[11px] md:text-[12px] tracking-tight truncate"
                  style={{ color: palette.bodyText }}
                >
                  {p.desc}
                </div>
              </div>
              <svg
                className="w-3.5 h-3.5 flex-shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{ color: palette.mutedText }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
        <a
          href="https://www.hatchingpoint.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 mt-2 pt-2 inline-flex items-center gap-1 text-[11px] tracking-tight border-t hover:opacity-100 opacity-70 transition-opacity"
          style={{ color: palette.mutedText, borderColor: palette.hairline }}
        >
          More on the App Store
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </Tile>
  )
}

/* ───────────────────── Marathon tile ──────────────────────── */

const MARATHON_DATE = new Date('2026-11-01T00:00:00')
const FALLBACK_RAISED = 1806
const FALLBACK_GOAL = 3000

function useDaysUntil(target: Date) {
  const [days, setDays] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target.getTime() - Date.now())
      setDays(Math.floor(diff / (1000 * 60 * 60 * 24)))
    }
    tick()
    // Days only need to refresh hourly at most.
    const id = setInterval(tick, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [target])
  return days
}

function MarathonTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const days = useDaysUntil(MARATHON_DATE)
  const [raised, setRaised] = useState(FALLBACK_RAISED)
  const [goal, setGoal] = useState(FALLBACK_GOAL)

  useEffect(() => {
    fetch('/api/fundraising')
      .then((r) => r.json())
      .then((data) => {
        if (data.raised !== null && data.raised !== undefined) {
          setRaised(data.raised)
          setGoal(data.goal)
        }
      })
      .catch(() => {})
  }, [])

  const pct = Math.min(100, Math.round((raised / goal) * 100))

  return (
    <Tile
      label="2026 TCS NYC Marathon"
      accent={{ light: '#c2410c', dark: '#ffb84d' }}
      deepLink="/#marathon"
      className="min-h-[180px] md:min-h-[210px]"
    >
      <div className="px-5 md:px-6 pt-3 pb-4 md:pb-5 flex-1 flex flex-col">
        {/* Header row: TCS NYC Marathon official logo + days countdown.
            White-bg chip preserves the official mark's contrast in both
            light and dark themes. */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0 px-2 py-1.5"
            style={{
              background: '#fff',
              boxShadow: isLight
                ? '0 1px 2px rgba(28,26,28,0.08), 0 0 0 1px rgba(0,0,0,0.04)'
                : '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.2)',
            }}
          >
            <Image
              src="/images/tcs-marathon-logo.png"
              alt="2026 TCS New York City Marathon"
              width={92}
              height={42}
              className="h-9 md:h-10 w-auto object-contain"
            />
          </div>
          <div className="flex-1 flex items-baseline gap-1.5 justify-end">
            <div
              className="text-[34px] md:text-[40px] font-semibold leading-none tracking-tight tabular-nums"
              style={{
                backgroundImage: palette.headlineGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {days ?? '—'}
            </div>
            <div className="text-[12px] md:text-[13px] font-medium tracking-tight" style={{ color: palette.mutedText }}>
              days
            </div>
          </div>
        </div>
        <div className="text-[11.5px] tracking-tight" style={{ color: palette.bodyText }}>
          Running for Team for Kids · NYRR
        </div>

        <div className="mt-auto pt-3">
          <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #E8642C 0%, #ffb84d 100%)',
                boxShadow: '0 0 12px rgba(232,100,44,0.35)',
                transition: 'width 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-[12px] font-semibold tabular-nums tracking-tight" style={{ color: isLight ? '#1c1a1c' : '#fff' }}>
              ${raised.toLocaleString()}
              <span className="font-normal ml-1" style={{ color: palette.mutedText }}>
                / ${goal.toLocaleString()}
              </span>
            </div>
            <a
              href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 text-[11px] font-semibold tracking-tight px-2.5 py-1 rounded-md hover:opacity-80 transition-opacity"
              style={{
                background: 'linear-gradient(180deg, #E8642C, #d05722)',
                color: '#fff',
              }}
            >
              Donate
            </a>
          </div>
        </div>
      </div>
    </Tile>
  )
}

/* ───────────────────── Contact tile ──────────────────────── */

const CONTACTS = [
  {
    label: 'Email',
    href: 'mailto:andrewsottiaux@gmail.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/andy-sottiaux-593700100/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/Andy-Sottiaux',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    label: 'HatchingPoint',
    href: 'https://www.hatchingpoint.com/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
]

function ContactTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Contact"
      deepLink="/#contact"
      className="min-h-[180px] md:min-h-[210px]"
    >
      <div className="px-5 md:px-6 pt-3 pb-4 md:pb-5 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-2 flex-1">
          {CONTACTS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target={c.href.startsWith('mailto:') ? undefined : '_blank'}
              rel={c.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
              className="relative z-10 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all hover:scale-[1.02]"
              style={{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                border: palette.cardBorder,
                color: isLight ? '#1c1a1c' : '#fff',
              }}
            >
              <div className="w-4 h-4 opacity-90">{c.icon}</div>
              <div className="text-[10.5px] font-semibold tracking-tight">{c.label}</div>
            </a>
          ))}
        </div>
        <div
          className="mt-3 text-[10px] tracking-wide text-center"
          style={{ color: palette.fadedText }}
        >
          © {new Date().getFullYear()} Andy Sottiaux
        </div>
      </div>
    </Tile>
  )
}
