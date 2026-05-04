'use client'

/**
 * CompactPortfolio — single-viewport bento alternative to the scrolling
 * home page. Lives at /compact for side-by-side evaluation.
 *
 * Two upgrades layered on top of the original bento:
 *
 *   1. Smart fallback tiles. The board (`/api/v3/health`) is polled by a
 *      single shared `useBoardLive()` hook with hysteresis (see lib).
 *      When live: row 1 shows Solar / Camera / Health.
 *      When stale: row 1 swaps to Stats / Building / MoreProjects with a
 *      cross-fade. Identical grid positions and column spans, so the rest
 *      of the bento doesn't reflow.
 *
 *   2. Modal expansion. Clicking a tile body opens an in-place modal with
 *      an expanded view of that section instead of navigating off to
 *      `/#section`. The deep-link `<a>` is still rendered as a fallback,
 *      but `onOpen` takes precedence when provided.
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
 * Mobile: stacks vertically. Modal renders full-bleed-ish.
 */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import FieldSolarCard from './FieldSolarCard'
import FieldHealthCard from './FieldHealthCard'
import { FieldThemeProvider, useFieldTheme } from './fieldTheme'
import Modal from './Modal'
import {
  AboutModalContent,
  AirpodsMountModalContent,
  ContactModalContent,
  ExperienceModalContent,
  LiveModalContent,
  MarathonModalContent,
  ProjectsModalContent,
  type ModalKey,
} from './CompactModals'
import { useBoardLive } from '@/lib/useBoardLive'

// Same dynamic import the home page uses — the camera feed polls a
// browser-side proxy, so SSR'ing it is wasted work.
const FieldCameraFeed = dynamic(() => import('./FieldCameraFeed'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black/80" />,
})

export default function CompactPortfolio({
  initialBoardLive = true,
}: {
  /** SSR-resolved board liveness, passed in from app/compact/page.tsx
   *  so the initial HTML already shows the correct (live or fallback)
   *  tiles — no fallback-then-live flicker for visitors arriving while
   *  the board is down. */
  initialBoardLive?: boolean
}) {
  return (
    <FieldThemeProvider>
      <CompactInner initialBoardLive={initialBoardLive} />
    </FieldThemeProvider>
  )
}

function CompactInner({ initialBoardLive }: { initialBoardLive: boolean }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const boardLive = useBoardLive(initialBoardLive)

  const [openModal, setOpenModal] = useState<ModalKey | null>(null)
  const close = () => setOpenModal(null)

  return (
    <main
      className="relative w-full flex flex-col min-h-screen md:h-[100dvh] md:overflow-hidden"
      style={{
        background: palette.sectionBackground,
        color: isLight ? '#1c1a1c' : '#fff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {/* Site is dark-only — no theme toggle, no header. The bento IS the
          page.

          Desktop / laptop: bento fills the viewport exactly. `md:h-[100dvh]`
          on <main> + `overflow-hidden` + a flex column that hands the
          remaining height down to the grid. Tile min-heights are zeroed on
          md+, the grid uses `1fr` rows, so cards auto-size to fit without
          ever scrolling.
          Mobile: keeps `min-h-screen` and natural vertical scrolling. */}
      <div className="bento-shell flex-1 flex flex-col px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 md:min-h-0">
        <div className="w-full max-w-[1380px] mx-auto md:flex-1 md:flex md:flex-col md:min-h-0">
          <Bento boardLive={boardLive} onOpen={setOpenModal} />
        </div>
      </div>

      {/* Modals — one source of truth, switched by current `openModal`.
          Stays mounted only when open so the dynamically imported camera
          feed in <LiveModalContent> doesn't poll while idle. */}
      <Modal
        open={openModal === 'about'}
        onClose={close}
        title="About Andy"
        eyebrow="Profile"
      >
        <AboutModalContent />
      </Modal>
      <Modal
        open={openModal === 'live'}
        onClose={close}
        title="Field Live"
        eyebrow="Edge-AI deployment"
        size="lg"
      >
        <LiveModalContent />
      </Modal>
      <Modal
        open={openModal === 'experience'}
        onClose={close}
        title="Experience"
        eyebrow="Career timeline"
        size="lg"
      >
        <ExperienceModalContent />
      </Modal>
      <Modal
        open={openModal === 'projects'}
        onClose={close}
        title="Projects"
        eyebrow="Things I've built"
        size="lg"
      >
        <ProjectsModalContent />
      </Modal>
      <Modal
        open={openModal === 'marathon'}
        onClose={close}
        title="2026 TCS NYC Marathon"
        eyebrow="Running for Team for Kids"
      >
        <MarathonModalContent />
      </Modal>
      <Modal
        open={openModal === 'contact'}
        onClose={close}
        title="Contact"
        eyebrow="Get in touch"
      >
        <ContactModalContent />
      </Modal>
      <Modal
        open={openModal === 'airpodsmount'}
        onClose={close}
        title="AirPods Tesla Mount"
        eyebrow="3D printed · CAD design"
      >
        <AirpodsMountModalContent />
      </Modal>

      {/* Random chinchilla mascot peeking from behind random tiles. Lives
          here at the page root so it can target any data-peek-target tile
          via DOMRect math without coupling to the bento layout. */}
      <ChinchillaPeek />
    </main>
  )
}

/* Header removed — bento itself is the page identity. The theme toggle
   floats in the top-right corner via CompactInner. */

/* ─────────────────────────── Bento ──────────────────────────── */

function Bento({
  boardLive,
  onOpen,
}: {
  boardLive: boolean
  onOpen: (key: ModalKey) => void
}) {
  return (
    <div
      className="grid gap-3 md:gap-4 mt-4 md:mt-0 md:flex-1 md:min-h-0 [grid-auto-rows:auto] md:[grid-auto-rows:minmax(0,1fr)]"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      }}
    >
      {/* Row 1: identity (3 cols) · camera-or-building (6 cols) · solar-or-stats (3 cols, spans 2 rows) */}
      <div className="col-span-12 md:col-span-3">
        <IdentityTile onOpen={() => onOpen('about')} />
      </div>

      {/* Wide tile (col 4–9): Camera when live, Building when stale */}
      <div className="col-span-12 md:col-span-6">
        <CrossfadeTile
          showLive={boardLive}
          live={<CameraTile onOpen={() => onOpen('live')} />}
          fallback={<BuildingTile />}
        />
      </div>

      {/* Tall tile (col 10–12, rows 1–2): Solar when live, MoreProjects
          when stale. The tall slot has room for many projects, so the
          long-tail of iOS apps lives here when the live data is down. */}
      <div className="col-span-12 md:col-span-3 md:row-span-2">
        <CrossfadeTile
          showLive={boardLive}
          live={<SolarTile onOpen={() => onOpen('live')} />}
          fallback={<MoreProjectsTile onOpen={onOpen} />}
        />
      </div>

      {/* Row 2: experience (5 cols) · health-or-more-projects (4 cols) · solar/stats already spans into this row */}
      <div className="col-span-12 md:col-span-5">
        <ExperienceTile onOpen={() => onOpen('experience')} />
      </div>
      {/* Mid tile (col 6–9, row 2, single-row): Health when live, Education
          when stale. Single-row slot is roughly square — fits the Texas
          Tech mark + degree info comfortably without forcing long
          vertical run. */}
      <div className="col-span-12 md:col-span-4">
        <CrossfadeTile
          showLive={boardLive}
          live={<HealthTile onOpen={() => onOpen('live')} />}
          fallback={<EducationTile />}
        />
      </div>

      {/* Row 3 */}
      <div className="col-span-12 md:col-span-5">
        <ProjectsTile onOpen={() => onOpen('projects')} />
      </div>
      <div className="col-span-12 md:col-span-4">
        <MarathonTile onOpen={() => onOpen('marathon')} />
      </div>
      <div className="col-span-12 md:col-span-3">
        <ContactTile onOpen={() => onOpen('contact')} />
      </div>
    </div>
  )
}

/* ─────────────────── Cross-fade wrapper ──────────────────────── */

function CrossfadeTile({
  showLive,
  live,
  fallback,
}: {
  showLive: boolean
  live: React.ReactNode
  fallback: React.ReactNode
}) {
  // Track previous state to keep both children mounted briefly during the
  // fade. After the fade we drop the inactive child so its polling timers
  // (camera feed, etc.) don't run forever.
  const [activeIsLive, setActiveIsLive] = useState(showLive)
  const [renderBoth, setRenderBoth] = useState(false)
  const firstRef = useRef(true)

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      setActiveIsLive(showLive)
      return
    }
    if (showLive === activeIsLive) return
    setRenderBoth(true)
    setActiveIsLive(showLive)
    const t = window.setTimeout(() => setRenderBoth(false), 320)
    return () => window.clearTimeout(t)
  }, [showLive, activeIsLive])

  // While crossfading: render both, the active one fully opaque, the
  // outgoing fading to 0. Steady state: render only the active one.
  if (!renderBoth) {
    return <>{activeIsLive ? live : fallback}</>
  }

  return (
    <div className="relative h-full">
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: activeIsLive ? 0 : 1 }}
      >
        {fallback}
      </div>
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: activeIsLive ? 1 : 0 }}
      >
        {live}
      </div>
      {/* Phantom sizer so the wrapper still has the height of one child */}
      <div className="invisible">{activeIsLive ? live : fallback}</div>
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
  onOpen,
  modalLabel,
}: {
  children: React.ReactNode
  className?: string
  /** small uppercase eyebrow color (passed to label) */
  accent?: { light: string; dark: string }
  label?: string
  /** when provided AND `onOpen` is NOT, the whole tile becomes a clickable
   *  link to that fragment on the full home page. Kept as a fallback so
   *  disabling modals doesn't break tile interactivity. */
  deepLink?: string
  /** when provided, the whole tile becomes a button that opens the
   *  matching modal. Wins over `deepLink`. */
  onOpen?: () => void
  /** Aria label for the modal-trigger button. Defaults to `Open ${label}`. */
  modalLabel?: string
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
      data-peek-target="true"
      className={`group relative z-[1] rounded-2xl overflow-hidden h-full flex flex-col ${className}`}
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: palette.cardShadow,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Whole-tile click target. `onOpen` (modal) wins over `deepLink`
          (anchor). Sits behind interactive content (z-0) so explicit
          inner <a>s and <button>s win the click. */}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={modalLabel ?? (label ? `Open ${label}` : 'Open')}
          className="absolute inset-0 z-0 cursor-pointer"
        />
      ) : deepLink ? (
        <a
          href={deepLink}
          aria-label={label ? `Open ${label} on the full site` : 'Open on the full site'}
          className="absolute inset-0 z-0"
        />
      ) : null}
      {label && (
        <div
          className="relative z-10 px-5 md:px-6 pt-4 md:pt-5 text-[10px] font-semibold uppercase tracking-[0.22em] flex items-center justify-between pointer-events-none"
          style={{ color: accentColor ?? palette.mutedText }}
        >
          <span>{label}</span>
          {(deepLink || onOpen) && (
            <svg
              className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {onOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M7 17L17 7M9 7h8v8" />
              )}
            </svg>
          )}
        </div>
      )}
      {/* Content sits above the click-target layer so its own anchors/buttons
          capture clicks first. */}
      <div className="relative z-10 flex flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}

/* ───────────────────── Identity tile ──────────────────────── */

function IdentityTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      deepLink="/#about"
      onOpen={onOpen}
      modalLabel="Open About"
      className="min-h-[170px] md:min-h-0"
    >
      <div className="flex-1 flex flex-col px-5 md:px-6 py-5 md:py-6">
        {/* Hero portrait — square card with a subtle ring + soft drop. */}
        <div className="flex justify-center">
          <div
            className="relative w-[108px] h-[108px] md:w-[116px] md:h-[116px] rounded-2xl overflow-hidden"
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
              sizes="(max-width: 768px) 108px, 116px"
              className="object-cover"
              priority
            />
          </div>
        </div>

        <div
          className="text-center text-[24px] md:text-[22px] font-semibold leading-tight tracking-tight mt-4"
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
          className="text-center text-[10.5px] md:text-[11px] uppercase tracking-[0.18em] mt-1.5"
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

function CameraTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Camera"
      accent={{ light: '#0a8aa8', dark: 'rgba(103, 232, 249, 0.9)' }}
      deepLink="/#now"
      onOpen={onOpen}
      modalLabel="Open Field Live"
      className="min-h-[170px] md:min-h-0"
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

function SolarTile({ onOpen }: { onOpen?: () => void }) {
  // FieldSolarCard already brings its own chrome. Wrap in a button or anchor
  // so the click on the card body opens the live modal (or, when modals are
  // disabled, deep-links to the home-page section).
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label="Open Field Live"
        className="block w-full h-full min-h-[360px] md:min-h-0 [&>div]:h-full hover:scale-[1.005] transition-transform duration-300 text-left"
      >
        <FieldSolarCard />
      </button>
    )
  }
  return (
    <a
      href="/#now"
      aria-label="Open Field Live on the full site"
      className="block h-full min-h-[360px] md:min-h-0 [&>div]:h-full hover:scale-[1.005] transition-transform duration-300"
    >
      <FieldSolarCard />
    </a>
  )
}

/* ───────────────────── Health tile ──────────────────────── */

function HealthTile({ onOpen }: { onOpen?: () => void }) {
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label="Open Field Live"
        className="block w-full h-full min-h-[260px] md:min-h-0 [&>div]:h-full hover:scale-[1.005] transition-transform duration-300 text-left"
      >
        <FieldHealthCard />
      </button>
    )
  }
  return (
    <a
      href="/#now"
      aria-label="Open Field Live on the full site"
      className="block h-full min-h-[260px] md:min-h-0 [&>div]:h-full hover:scale-[1.005] transition-transform duration-300"
    >
      <FieldHealthCard />
    </a>
  )
}

/* ───────────────── Fallback tiles (board offline) ───────────────── */

/** Replaces SolarTile (tall right column, 2-row span). Three crisp facts
 *  in a stacked vertical layout. Designed to feel substantive without
 *  reading as filler. */
/** Education fallback for the tall right-column slot. Replaces SolarTile
 *  when the board is offline. Texas Tech mark + degree info — concrete,
 *  visual, and personal. */
/** Replaces HealthTile (mid-row, 4 cols × 1 row, ~square slot) when the
 *  board is offline. Texas Tech mark + degree info in a horizontal layout
 *  so it fits a square slot without forcing a tall vertical run. */
function EducationTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div
      className="relative z-[1] rounded-2xl h-full min-h-[260px] md:min-h-0 flex flex-col p-5 md:p-6 overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: palette.cardShadow,
      }}
      data-peek-target="true"
      role="region"
      aria-label="Education"
    >
      {/* Texas Tech red ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full"
        style={{
          background: isLight
            ? 'radial-gradient(circle, rgba(204,0,0,0.08), transparent 70%)'
            : 'radial-gradient(circle, rgba(204,0,0,0.16), transparent 70%)',
        }}
      />
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: isLight ? '#cc0000' : '#ff7a7a' }}
      >
        Education
      </div>

      {/* Horizontal layout — logo on the left, text on the right. Fits a
          square slot far better than the previous vertically stacked one. */}
      <div className="relative flex-1 flex items-center gap-4 md:gap-5">
        <div
          className="flex items-center justify-center rounded-xl flex-shrink-0 p-2.5"
          style={{
            background: isLight ? '#fff' : 'rgba(255,255,255,0.96)',
            boxShadow: isLight
              ? '0 6px 18px rgba(28,26,28,0.10), 0 0 0 1px rgba(0,0,0,0.04)'
              : '0 10px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.15)',
            width: '88px',
            height: '88px',
          }}
        >
          <Image
            src="/images/texas-tech-logo.png"
            alt="Texas Tech University"
            width={72}
            height={72}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="text-[15px] md:text-[16px] font-semibold tracking-tight leading-tight"
            style={{
              backgroundImage: palette.headlineGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            B.S. Mechanical Engineering
          </div>
          <div
            className="text-[12px] tracking-tight mt-1"
            style={{ color: palette.bodyText }}
          >
            Texas Tech University · 2016
          </div>
          <div
            className="text-[11px] tracking-tight mt-1 italic"
            style={{ color: palette.mutedText }}
          >
            Minor in Mathematics
          </div>
        </div>
      </div>

      <div
        className="text-[10px] uppercase tracking-[0.18em] font-medium mt-auto text-center pt-3 border-t"
        style={{ color: palette.fadedText, borderColor: palette.hairline }}
      >
        Study abroad · Seville, Spain
      </div>
    </div>
  )
}

/** Replaces CameraTile (wide hero) when the board is offline. A magazine
 *  spread — gradient headline, restrained subtitle, and a single quiet
 *  hero element: a slow-rotating engineering-blueprint rotor that bleeds
 *  off the right edge. One focal element (instead of a busy icon row)
 *  reads as confident industrial design, not a developer dashboard. */
function BuildingTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  // Single accent (cyan) — restrained palette, theme-aware.
  const accent = isLight ? '#0a8aa8' : '#67e8f9'
  const accentSoft = isLight ? 'rgba(10,138,168,0.45)' : 'rgba(103,232,249,0.55)'
  const accentFaint = isLight ? 'rgba(10,138,168,0.18)' : 'rgba(103,232,249,0.22)'

  return (
    <div
      className="relative z-[1] rounded-2xl h-full min-h-[170px] md:min-h-0 flex flex-col p-6 md:p-7 overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: palette.cardShadow,
      }}
      data-peek-target="true"
      role="region"
      aria-label="Currently building"
    >
      {/* Single soft accent halo — bottom-left so it weights the type
          column visually without competing with the icon row. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-16 w-[28rem] h-72 rounded-full"
        style={{
          background: isLight
            ? 'radial-gradient(circle, rgba(10,138,168,0.10), transparent 70%)'
            : 'radial-gradient(circle, rgba(103,232,249,0.14), transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 w-72 h-56 rounded-full"
        style={{
          background: isLight
            ? 'radial-gradient(circle, rgba(252,211,77,0.06), transparent 70%)'
            : 'radial-gradient(circle, rgba(252,211,77,0.10), transparent 70%)',
        }}
      />

      {/* Eyebrow row — eyebrow + small "always shipping" pulse */}
      <div className="relative flex items-center justify-between mb-3">
        <div
          className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
              animation: 'fldBuildPulse 2.4s ease-in-out infinite',
            }}
          />
          Currently Building
        </div>
        <div
          className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: palette.fadedText }}
        >
          Always shipping
        </div>
      </div>

      {/* Hero gradient typography — three crisp fragments. Reads as a
          rhythm: hardware · embedded · iOS, in the language of artifacts
          rather than category labels. */}
      <h3
        className="relative font-semibold leading-[1.05] tracking-tight"
        style={{
          fontSize: 'clamp(22px, 3.4vw, 34px)',
          backgroundImage: palette.headlineGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Rotor design. Edge devices.
        <br className="hidden sm:inline" />
        <span className="sm:ml-0"> iOS apps.</span>
      </h3>

      <p
        className="relative text-[12.5px] md:text-[13px] leading-snug tracking-tight mt-2.5 max-w-[36ch]"
        style={{ color: palette.bodyText }}
      >
        Building hardware and software at production scale — from AVX
        Aircraft to the App Store.
      </p>

      {/* Engineering-blueprint rotor — anchored bottom-right, bleeds past
          the card edge. One slow-rotating element instead of a busy icon
          row. Reinforces "Rotor design" without competing with the type. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          right: '-22%',
          bottom: '-32%',
          width: 'min(78%, 360px)',
          aspectRatio: '1 / 1',
          opacity: isLight ? 0.85 : 0.95,
          // soft mask so the rotor fades into the card edge rather than
          // hard-clipping at overflow:hidden
          WebkitMaskImage:
            'radial-gradient(circle at 60% 60%, #000 55%, transparent 85%)',
          maskImage:
            'radial-gradient(circle at 60% 60%, #000 55%, transparent 85%)',
        }}
      >
        <svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* dotted concentric measurement circles — engineering datum */}
          <circle cx="100" cy="100" r="92" stroke={accentFaint} strokeWidth="0.6" strokeDasharray="1 4" />
          <circle cx="100" cy="100" r="74" stroke={accentFaint} strokeWidth="0.6" strokeDasharray="1 4" />
          <circle cx="100" cy="100" r="50" stroke={accentFaint} strokeWidth="0.6" strokeDasharray="2 5" />
          {/* crosshair datum */}
          <line x1="6" y1="100" x2="194" y2="100" stroke={accentFaint} strokeWidth="0.5" strokeDasharray="3 4" />
          <line x1="100" y1="6" x2="100" y2="194" stroke={accentFaint} strokeWidth="0.5" strokeDasharray="3 4" />

          {/* rotating rotor assembly — 4-blade with hub */}
          <g
            style={{
              transformOrigin: '100px 100px',
              animation: 'fldRotorSpin 48s linear infinite',
            }}
          >
            {/* swept-disc envelope */}
            <circle cx="100" cy="100" r="86" stroke={accentSoft} strokeWidth="0.8" opacity="0.4" />

            {/* 4 blades — leading edge solid, trailing edge thinner, with
                a chord-line down the middle and tapered tip caps */}
            {[0, 90, 180, 270].map((deg) => (
              <g key={deg} transform={`rotate(${deg} 100 100)`}>
                <path
                  d="M100 100 L96 32 Q100 22 104 32 Z"
                  stroke={accent}
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* chord line — feathered */}
                <line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="30"
                  stroke={accentSoft}
                  strokeWidth="0.5"
                  strokeDasharray="2 3"
                />
                {/* tip cap */}
                <circle cx="100" cy="28" r="2.2" stroke={accent} strokeWidth="0.9" fill="none" />
              </g>
            ))}

            {/* central hub — concentric machined detail */}
            <circle cx="100" cy="100" r="14" stroke={accent} strokeWidth="1.2" fill="none" />
            <circle cx="100" cy="100" r="9" stroke={accentSoft} strokeWidth="0.8" fill="none" />
            <circle cx="100" cy="100" r="3.5" fill={accent} opacity="0.9" />
            {/* hub bolt circle */}
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180
              const x = 100 + Math.cos(rad) * 11.5
              const y = 100 + Math.sin(rad) * 11.5
              return <circle key={deg} cx={x} cy={y} r="0.9" fill={accentSoft} />
            })}
          </g>

          {/* fixed dimension callout — small Ø annotation on the
              measurement circle; gives it the "drawing" feel */}
          <g opacity="0.5">
            <line x1="14" y1="100" x2="22" y2="100" stroke={accentSoft} strokeWidth="0.5" />
            <text
              x="13"
              y="96"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontSize="6"
              fill={accentSoft}
              textAnchor="end"
            >
              Ø184
            </text>
          </g>
        </svg>
      </div>

      {/* tiny live "design ↻" annotation in the bottom-left so the rotor
          is read as work-in-progress, not decoration */}
      <div
        className="relative mt-auto pt-5 inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: palette.fadedText }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ animation: 'fldRotorSpin 6s linear infinite', transformOrigin: 'center' }}
        >
          <path d="M10 5a4 4 0 1 1-1.2-2.8" />
          <path d="M10 1.5V5H6.5" />
        </svg>
        Rotor · in design
      </div>

      <style jsx global>{`
        @keyframes fldBuildPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.25); }
        }
        @keyframes fldRotorSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/** Replaces SolarTile (tall right column, 3 cols × 2 rows) when the
 *  board is offline. Long-tail iOS catalog + a CAD download to add a
 *  hardware artifact alongside the apps. Each row is its own external
 *  link. Icons are ACTUAL App Store icons matched to each app — earlier
 *  versions had them mismatched. */
const MORE_PROJECTS: {
  name: string
  desc: string
  icon?: string
  iconRender?: React.ReactNode
  href: string
  download?: boolean
  note?: string
  /** Render a live STL viewer in the chip + open the airpods-mount modal
   *  on click instead of navigating. */
  cad?: boolean
}[] = [
  {
    name: 'AirMD+',
    desc: 'HVAC monitoring · iOS + custom hardware',
    icon: '/images/airmd-icon.jpg',
    href: 'https://www.hatchingpoint.com/airmd',
  },
  {
    name: 'LevelUp+',
    desc: 'Personal advancement tracker · iOS',
    icon: '/images/levelup-icon.jpg',
    href: 'https://apps.apple.com/us/app/levelup/id6757681084',
  },
  {
    name: 'Caffeine Rhythm',
    desc: 'Caffeine half-life timing · iOS · HealthKit',
    icon: '/images/caffeine-icon.jpg',
    href: 'https://apps.apple.com/us/app/caffeine-rhythm/id6756790180',
  },
  {
    name: 'DoorDot',
    desc: 'NFC privacy doorbell · iOS · CloudKit',
    icon: '/images/doordot-icon.png',
    href: 'https://apps.apple.com/app/doordot/id6758969043',
  },
  {
    name: 'Travel Agent AI',
    desc: 'AI trip-planning assistant · iOS',
    icon: '/images/travelagentai-icon.png',
    href: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691',
  },
  // CAD entry — shorter name, opens the in-page 3D modal instead of
  // navigating. The icon slot renders a live STL preview (lazy-loaded).
  {
    name: 'AirPods Tesla Mount',
    desc: 'CAD design · STL + SLDPRT downloads',
    href: '#airpods-mount',
    note: 'CAD',
    cad: true,
  },
]

// Lazy STL preview chip — three.js only loads when the tile is in DOM
// and the chip is visible. Tiny scene; perf is fine.
const STLViewerLazy = dynamic(() => import('./STLViewer'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-black/10" />,
})

function MoreProjectsTile({ onOpen }: { onOpen?: (key: ModalKey) => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const accent = isLight ? '#b45309' : 'rgba(252, 211, 77, 0.9)'

  return (
    <div
      className="relative z-[1] rounded-2xl h-full min-h-[360px] md:min-h-0 flex flex-col overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: palette.cardShadow,
      }}
      data-peek-target="true"
      role="region"
      aria-label="More projects"
    >
      {/* Warm corner halo to distinguish this fallback from the live solar tile */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full"
        style={{
          background: isLight
            ? 'radial-gradient(circle, rgba(180,83,9,0.10), transparent 70%)'
            : 'radial-gradient(circle, rgba(252,211,77,0.14), transparent 70%)',
        }}
      />
      <div
        className="px-5 md:px-6 pt-4 md:pt-5 text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: accent }}
      >
        More Projects
      </div>
      <div className="px-5 md:px-6 pt-3 pb-4 md:pb-5 flex-1 flex flex-col">
        <div className="space-y-2.5 md:space-y-3 flex-1">
          {MORE_PROJECTS.map((p) => {
            const isCad = !!p.cad
            // Common chip + content the row renders, regardless of action.
            const chip = (
              <div
                className="w-10 h-10 rounded-[10px] overflow-hidden flex-shrink-0 flex items-center justify-center relative"
                style={{
                  border: palette.cardBorder,
                  background: isLight ? '#fff' : 'rgba(255,255,255,0.04)',
                  color: accent,
                }}
              >
                {isCad ? (
                  // Tiny live STL preview — slow auto-rotate, no controls.
                  <div className="absolute inset-0 [&>div]:!w-full [&>div]:!h-full">
                    <STLViewerLazy
                      urls={[
                        '/files/assembly-mount.STL',
                        '/files/assembly-airpods.STL',
                      ]}
                    />
                  </div>
                ) : p.icon ? (
                  <Image
                    src={p.icon}
                    alt=""
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-5 h-5 block">{p.iconRender}</span>
                )}
              </div>
            )
            const body = (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[13px] md:text-[14px] font-semibold tracking-tight truncate"
                      style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                    >
                      {p.name}
                    </span>
                    {p.note && (
                      <span
                        className="text-[9.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          color: accent,
                          background: isLight ? `${accent}14` : `${accent}22`,
                          border: `1px solid ${accent}33`,
                        }}
                      >
                        {p.note}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[11px] md:text-[12px] tracking-tight truncate mt-0.5"
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
                  {isCad ? (
                    // square icon for "open dialog"
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
                  ) : p.download ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  )}
                </svg>
              </>
            )

            // CAD entry opens the modal; everything else is a real link.
            if (isCad) {
              return (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => onOpen?.('airpodsmount')}
                  className="group relative z-10 flex items-center gap-3 py-1.5 rounded-lg -mx-1 px-1 transition-colors text-left w-full"
                  aria-label={`Open ${p.name}`}
                >
                  {chip}
                  {body}
                </button>
              )
            }
            return (
              <a
                key={p.name}
                href={p.href}
                {...(p.download
                  ? { download: '' }
                  : { target: '_blank', rel: 'noopener noreferrer' })}
                className="group relative z-10 flex items-center gap-3 py-1.5 rounded-lg -mx-1 px-1 transition-colors"
              >
                {chip}
                {body}
              </a>
            )
          })}
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
    </div>
  )
}

/* ───────────────────── Experience tile ──────────────────────── */

// Per-company logo metadata. Plates are ALL the same fixed square size.
// `scale` is a per-logo zoom factor that compensates for differing
// amounts of native whitespace baked into each source image — without
// it, a logo with a lot of canvas margin (e.g. Texas Air's tiny
// wordmark on a square JPEG) renders much smaller than one with a tight
// crop (e.g. AVX's bowtie). Tuned by eye to give each mark roughly the
// same visual weight inside its plate.
const EXPERIENCE: {
  title: string
  company: string
  period: string
  url: string
  current?: boolean
  logo: string
  scale?: number
}[] = [
  {
    title: 'Senior Engineer',
    company: 'AVX Aircraft',
    period: 'Sep 2023 — Present',
    url: 'https://www.avxaircraft.com/',
    current: true,
    logo: '/images/avx.png',
    scale: 1.0,
  },
  {
    title: 'Founder',
    company: 'HatchingPoint',
    period: '2021 — Present',
    url: 'https://www.hatchingpoint.com',
    logo: '/images/hatchingpoint-logo.jpeg',
    scale: 1.05,
  },
  {
    title: 'Rotor Systems',
    company: 'Bell Flight',
    period: '2020 — 2023',
    url: 'https://www.bellflight.com',
    logo: '/images/bell.svg',
    scale: 1.05,
  },
  {
    title: 'Project Manager',
    company: 'Texas Air Systems',
    period: '2016 — 2020',
    url: 'https://www.texasairsystems.com/',
    logo: '/images/texasairsystems-logo.jpeg',
    scale: 1.45,
  },
]

function ExperienceTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Experience"
      accent={{ light: '#0f9d4f', dark: 'rgb(74 222 128 / 0.9)' }}
      deepLink="/#experience"
      onOpen={onOpen}
      modalLabel="Open Experience"
      className="min-h-[200px] md:min-h-0"
    >
      <div className="px-5 md:px-6 pt-3 pb-4 md:pb-5 flex-1 flex flex-col">
        <div className="space-y-2 md:space-y-2.5">
          {EXPERIENCE.map((e) => {
            return (
              <a
                key={e.company}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 group flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0"
                style={{ borderColor: palette.hairline }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Logo chip — uniform 36×36 square plate. Per-logo
                      `scale` compensates for differing native whitespace
                      so each mark reads at roughly the same visual weight
                      inside the same-sized plate. */}
                  <div
                    className="flex items-center justify-center rounded-md flex-shrink-0 overflow-hidden"
                    style={{
                      width: 36,
                      height: 36,
                      background: '#fff',
                      boxShadow: isLight
                        ? '0 1px 2px rgba(28,26,28,0.08), 0 0 0 1px rgba(0,0,0,0.04)'
                        : '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)',
                    }}
                  >
                    <Image
                      src={e.logo}
                      alt={`${e.company} logo`}
                      width={56}
                      height={56}
                      className="w-auto h-auto object-contain"
                      style={{
                        maxWidth: '78%',
                        maxHeight: '78%',
                        transform: `scale(${e.scale ?? 1})`,
                        transformOrigin: 'center',
                      }}
                    />
                  </div>

                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
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
                </div>
                <span
                  className="text-[11px] md:text-[12px] tabular-nums tracking-tight flex-shrink-0 group-hover:opacity-100 opacity-80 transition-opacity"
                  style={{ color: palette.mutedText }}
                >
                  {e.period}
                </span>
              </a>
            )
          })}
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

function ProjectsTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Projects"
      accent={{ light: '#b45309', dark: 'rgba(252, 211, 77, 0.9)' }}
      deepLink="/#projects"
      onOpen={onOpen}
      modalLabel="Open Projects"
      className="min-h-[180px] md:min-h-0"
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

function MarathonTile({ onOpen }: { onOpen?: () => void }) {
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

  // Theme-aware text colors. The card itself sits on the regular bento
  // glass-bg with a strong TCS-orange outline + accent ring instead of a
  // saturated orange brand block — distinct enough to read as a bib without
  // shouting over the rest of the bento.
  const numberColor = isLight ? '#1c1a1c' : '#fff'
  const subtleText = isLight ? 'rgba(28,26,28,0.65)' : 'rgba(255,255,255,0.7)'

  return (
    <div
      className="relative z-[1] rounded-2xl h-full min-h-[180px] md:min-h-0 overflow-hidden group"
      data-peek-target="true"
      role="region"
      aria-label="2026 TCS NYC Marathon"
      style={{
        background: palette.cardBackground,
        // 1.5px TCS-orange outline + a soft warm halo just behind it so the
        // edge feels deliberate rather than thin.
        boxShadow: isLight
          ? '0 0 0 1.5px #E8642C, 0 8px 24px rgba(232,100,44,0.10), inset 0 1px 0 rgba(255,255,255,0.6)'
          : '0 0 0 1.5px #E8642C, 0 12px 32px rgba(232,100,44,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Whole-tile clickable layer that opens the modal (sits behind the
          inner Donate button; foreground anchors capture clicks first). */}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open 2026 TCS NYC Marathon"
          className="absolute inset-0 z-0 cursor-pointer"
        />
      )}

      {/* Soft warm corner halo (chevron stripes removed per design feedback) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-12 w-72 h-72 rounded-full"
        style={{
          background: isLight
            ? 'radial-gradient(circle, rgba(232,100,44,0.10), transparent 70%)'
            : 'radial-gradient(circle, rgba(232,100,44,0.18), transparent 70%)',
        }}
      />

      <div className="relative z-10 px-5 md:px-6 pt-4 pb-4 md:pb-5 h-full grid gap-3 md:gap-4 grid-cols-[1fr_auto] grid-rows-[auto_1fr_auto] items-start">
        {/* Top-left: TCS logo on white chip */}
        <div
          className="inline-flex items-center justify-center rounded-xl px-3 py-2 self-start justify-self-start"
          style={{
            background: '#fff',
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          }}
        >
          <Image
            src="/images/tcs-marathon-logo.png"
            alt="2026 TCS New York City Marathon"
            width={140}
            height={100}
            className="h-14 md:h-16 w-auto object-contain"
          />
        </div>

        {/* Top-right: date chip aligned with logo row */}
        <div
          className="text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full justify-self-end self-start"
          style={{
            background: isLight ? 'rgba(232,100,44,0.10)' : 'rgba(232,100,44,0.18)',
            color: isLight ? '#c63d1f' : '#ff8a4a',
            border: isLight ? '1px solid rgba(232,100,44,0.25)' : '1px solid rgba(232,100,44,0.35)',
          }}
        >
          Nov 1, 2026
        </div>

        {/* Mid-left: countdown + cause line */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full self-center"
              style={{
                background: '#E8642C',
                boxShadow: '0 0 10px rgba(232,100,44,0.7)',
                animation: 'fldMarathonPulse 1.8s ease-in-out infinite',
              }}
            />
            <div
              className="text-[40px] md:text-[52px] font-bold leading-none tracking-tight tabular-nums"
              style={{ color: numberColor }}
            >
              {days ?? '—'}
            </div>
            <div
              className="text-[12px] md:text-[13px] font-bold uppercase tracking-[0.22em] pb-1.5"
              style={{ color: subtleText }}
            >
              Days
            </div>
          </div>
          <div className="text-[11.5px] md:text-[12px] tracking-tight mt-2" style={{ color: subtleText }}>
            Running for <span className="font-semibold" style={{ color: numberColor }}>Team for Kids</span> · NYRR
          </div>
        </div>

        {/* Mid-right: physical QR code chip — scanner reticle around a white
            tile holding the live NYRR donation QR. The QR is the donate
            button: tap on desktop, scan on mobile. */}
        <a
          href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Scan or tap to donate"
          className="relative z-10 row-span-2 self-start group"
        >
          <div
            className="marathon-qr relative rounded-xl p-2 transition-transform duration-300 group-hover:-translate-y-0.5"
            style={{
              background: '#fff',
              boxShadow:
                '0 0 0 1.5px rgba(232,100,44,0.55), 0 8px 22px rgba(232,100,44,0.22), inset 0 1px 0 rgba(255,255,255,0.6)',
            }}
          >
            <Image
              src="/images/nyrr-qr.png"
              alt="Donation QR code"
              fill
              className="object-contain p-2"
              sizes="(max-width: 639px) 88px, 104px"
            />
            {/* Scanner reticle corners — purely decorative */}
            <span aria-hidden="true" className="absolute -top-[3px] -left-[3px] w-3 h-3 border-t-2 border-l-2 rounded-tl-md" style={{ borderColor: '#E8642C' }} />
            <span aria-hidden="true" className="absolute -top-[3px] -right-[3px] w-3 h-3 border-t-2 border-r-2 rounded-tr-md" style={{ borderColor: '#E8642C' }} />
            <span aria-hidden="true" className="absolute -bottom-[3px] -left-[3px] w-3 h-3 border-b-2 border-l-2 rounded-bl-md" style={{ borderColor: '#E8642C' }} />
            <span aria-hidden="true" className="absolute -bottom-[3px] -right-[3px] w-3 h-3 border-b-2 border-r-2 rounded-br-md" style={{ borderColor: '#E8642C' }} />
          </div>
          <div
            className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-center inline-flex items-center justify-center gap-1 w-full"
            style={{ color: isLight ? '#c63d1f' : '#ff8a4a' }}
          >
            Scan · Donate
            <svg className="w-2.5 h-2.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>

        {/* Bottom-left (spans full bottom row): progress bar + amounts */}
        <div className="col-span-2 self-end">
          <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
            <div
              className="h-full rounded-full relative overflow-hidden"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #E8642C 0%, #ffb84d 100%)',
                boxShadow: '0 0 14px rgba(232,100,44,0.45)',
                transition: 'width 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                  animation: 'fldMarathonShimmer 2.6s linear infinite',
                }}
              />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <div className="text-[13px] font-bold tabular-nums tracking-tight" style={{ color: numberColor }}>
              ${raised.toLocaleString()}
              <span className="font-medium ml-1" style={{ color: subtleText }}>
                / ${goal.toLocaleString()}
              </span>
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: subtleText }}>
              {pct}% funded
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fldMarathonPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.2); }
        }
        @keyframes fldMarathonShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%);  }
        }
      `}</style>
    </div>
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
      <span
        aria-hidden
        className="block w-full h-full"
        style={{
          backgroundColor: 'currentColor',
          WebkitMaskImage: 'url(/images/hatchingpoint-mark.png?v=3)',
          maskImage: 'url(/images/hatchingpoint-mark.png?v=3)',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    ),
  },
]

function ContactTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Contact"
      deepLink="/#contact"
      onOpen={onOpen}
      modalLabel="Open Contact"
      className="min-h-[180px] md:min-h-0"
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
              <div className="w-5 h-5 opacity-90">{c.icon}</div>
              <div className="text-[12px] font-semibold tracking-tight">{c.label}</div>
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

/* ───────────────────── Chinchilla peek ──────────────────────── */

/**
 * Mascot easter egg — picks a random `[data-peek-target="true"]` tile
 * every 8–18 s, slides the chinchilla in from one of its edges so it
 * looks like it's peeking out from behind that tile, holds for ~2.5 s,
 * then ducks back. Reduced-motion users see nothing. Pointer-events
 * disabled so it never intercepts clicks.
 *
 * Z-index is intentionally low — the tile's opaque glass background
 * obscures the body of the chinchilla; only the part that escapes the
 * tile boundary into the gutter is visible, which sells the "peeking"
 * illusion.
 */
type PeekEdge = 'left' | 'right' | 'bottom'

function ChinchillaPeek() {
  type PeekState = {
    rect: DOMRect | null
    edge: PeekEdge
    /** how visible the chinchilla is, 0 (hidden) → 1 (peeked out) */
    out: number
    /** monotonic counter so React re-renders even if values match */
    seq: number
  }

  const [pose, setPose] = useState<PeekState>({
    rect: null,
    edge: 'right',
    out: 0,
    seq: 0,
  })
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const cycle = () => {
      if (cancelledRef.current) return
      const targets = document.querySelectorAll<HTMLElement>(
        '[data-peek-target="true"]',
      )
      if (targets.length === 0) {
        timer = setTimeout(cycle, 5000)
        return
      }
      const tile = targets[Math.floor(Math.random() * targets.length)]
      const rect = tile.getBoundingClientRect()
      // Skip very small / off-screen tiles.
      if (rect.width < 80 || rect.height < 80) {
        timer = setTimeout(cycle, 4000)
        return
      }
      const edges: PeekEdge[] = ['left', 'right', 'bottom']
      const edge = edges[Math.floor(Math.random() * edges.length)]
      // Step 1 — peek out
      setPose((p) => ({ rect, edge, out: 1, seq: p.seq + 1 }))
      // Step 2 — hide after 2.4–3.6 s
      timer = setTimeout(
        () => {
          if (cancelledRef.current) return
          setPose((p) => ({ ...p, out: 0 }))
          // Step 3 — schedule next peek 8–18 s later
          timer = setTimeout(cycle, 8000 + Math.random() * 10000)
        },
        2400 + Math.random() * 1200,
      )
    }

    // First peek arrives ~5–9 s after mount so the page has time to settle.
    timer = setTimeout(cycle, 5000 + Math.random() * 4000)
    return () => {
      cancelledRef.current = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!pose.rect) return null

  // Geometry. Tile-edge origin + transform-translate for the slide.
  const size = 64
  // How far past the tile edge the chinchilla pokes when fully out.
  const protrude = 24
  // Where the chinchilla parks when "in" (mostly hidden by tile bg).
  const tuck = size - 6 // leave a 6px sliver, enough so the slide reads

  const r = pose.rect
  let left = 0
  let top = 0
  let translate = ''
  let flipX = 1

  if (pose.edge === 'right') {
    // Anchored just outside the right edge of the tile, vertically lower-third.
    left = r.right - tuck
    top = r.top + r.height * 0.62 - size / 2
    translate = `translateX(${pose.out ? protrude : 0}px)`
    // Face the chinchilla looking toward the right (default).
    flipX = -1
  } else if (pose.edge === 'left') {
    left = r.left - (size - tuck)
    top = r.top + r.height * 0.62 - size / 2
    translate = `translateX(${pose.out ? -protrude : 0}px)`
    // Face left.
    flipX = 1
  } else {
    // bottom — peek from under the tile, central horizontal.
    left = r.left + r.width * 0.5 - size / 2
    top = r.bottom - tuck
    translate = `translateY(${pose.out ? protrude : 0}px)`
  }

  // Tiny tilt while peeking for personality.
  const rotate = pose.out
    ? pose.edge === 'right'
      ? -8
      : pose.edge === 'left'
        ? 8
        : 0
    : 0

  // Clamp to viewport so the sprite never lands behind the URL bar or
  // off the right edge on narrow mobile screens. The translate can move
  // the sprite up to `protrude` past `left`/`top`, so the safe window
  // shrinks by that amount on each axis.
  if (typeof window !== 'undefined') {
    const margin = protrude + 4
    const vw = window.innerWidth
    const vh = window.innerHeight
    const minLeft = margin
    const maxLeft = vw - size - margin
    const minTop = margin
    const maxTop = vh - size - margin
    if (maxLeft >= minLeft) left = Math.min(Math.max(left, minLeft), maxLeft)
    if (maxTop >= minTop) top = Math.min(Math.max(top, minTop), maxTop)
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={{
        left,
        top,
        width: size,
        height: size,
        zIndex: 0,
        transform: `${translate} rotate(${rotate}deg) scaleX(${flipX})`,
        transformOrigin: 'center',
        transition:
          'transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s linear',
        opacity: pose.rect ? 1 : 0,
        // Tiny shadow to ground the chinchilla against the tile edge.
        filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))',
      }}
    >
      <Image
        src="/images/chinchilla-white.png"
        alt=""
        width={size}
        height={size}
        className="w-full h-full"
      />
    </div>
  )
}
