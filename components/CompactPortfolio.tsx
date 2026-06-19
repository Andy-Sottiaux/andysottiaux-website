'use client'

/**
 * CompactPortfolio — single-viewport bento alternative to the scrolling
 * home page. Lives at /compact for side-by-side evaluation.
 *
 * Two upgrades layered on top of the original bento:
 *
 *   1. Smart fallback tiles. The board (`/api/v3/health`) is polled by a
 *      single shared `useBoardLive()` hook with hysteresis (see lib).
 *      Camera stays visible even when health is unreachable, so visitors see
 *      the stream's own offline state instead of the feed disappearing. Solar
 *      is independent now because it comes from the Raspberry Pi/Victron path;
 *      only health swaps to fallback content when the camera board is stale.
 *
 *   2. Modal expansion. Clicking a tile body opens an in-place modal with
 *      an expanded view of that section instead of navigating off to
 *      `/#section`. The deep-link `<a>` is still rendered as a fallback,
 *      but `onOpen` takes precedence when provided.
 *
 * Layout (1440×900 desktop, viewport-filling bento):
 *   ┌────────────┬─────────────────────────┬────────────┐
 *   │ identity   │ camera                  │ solar      │
 *   ├────────────┤                         │            │
 *   │ health     │                         │            │
 *   ├────────────┴──────────────┬──────────┴────────────┤
 *   │ experience                │ marathon │ contact    │
 *   ├───────────────────────────┤          │            │
 *   │ projects                  │          │            │
 *   └───────────────────────────┴──────────┴────────────┘
 *
 * Mobile: stacks vertically. Modal renders full-bleed-ish.
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import CameraIdleSurface from './CameraIdleSurface'
import FieldSolarCard from './FieldSolarCard'
import FieldHealthCard from './FieldHealthCard'
import { FieldThemeProvider, useFieldTheme } from './fieldTheme'
import Modal from './Modal'
import type { ModalKey } from './CompactModals'
import { useBoardLive } from '@/lib/useBoardLive'
import { haptic } from '@/lib/haptics'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import { useReducedMotion } from '@/lib/useReducedMotion'

// Same dynamic import the home page uses. The switcher keeps Cam 1 on the
// original relay feed and routes Cam 2 to the Thingino view client-side.
const CameraFeedSwitcher = dynamic(() => import('./CameraFeedSwitcher'), {
  ssr: false,
  loading: () => <CameraIdleSurface mode="loading" />,
})

type LiveModalContentProps = {
  selectedCamera?: FieldCameraSource
  onCameraChange?: (value: FieldCameraSource) => void
}

const AboutModalContent = dynamic(() => import('./CompactModals').then((m) => m.AboutModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const LiveModalContent = dynamic<LiveModalContentProps>(() => import('./CompactModals').then((m) => m.LiveModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const ExperienceModalContent = dynamic(() => import('./CompactModals').then((m) => m.ExperienceModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const ProjectsModalContent = dynamic(() => import('./CompactModals').then((m) => m.ProjectsModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const MarathonModalContent = dynamic(() => import('./CompactModals').then((m) => m.MarathonModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const ContactModalContent = dynamic(() => import('./CompactModals').then((m) => m.ContactModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const AirpodsMountModalContent = dynamic(() => import('./CompactModals').then((m) => m.AirpodsMountModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
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
  const [selectedCamera, setSelectedCamera] = useState<FieldCameraSource>('field')
  const close = () => setOpenModal(null)
  const open = (key: ModalKey) => setOpenModal(key)

  return (
    <main
      id="main-content"
      className="relative w-full flex flex-col min-h-screen lg:h-[100dvh] lg:overflow-hidden"
      style={{
        background: palette.sectionBackground,
        color: isLight ? '#1c1a1c' : '#fff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {/* Site is dark-only — no theme toggle, no header. The bento IS the
          page.

          Desktop / laptop: bento fills the viewport exactly. `lg:h-[100dvh]`
          on <main> + `overflow-hidden` + a flex column that hands the
          remaining height down to the grid. Tile min-heights are zeroed on
          lg+, the grid uses `1fr` rows, so cards auto-size to fit without
          ever scrolling.
          Mobile: keeps `min-h-screen` and natural vertical scrolling. */}
      <div
        className="bento-shell flex-1 flex flex-col px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 lg:min-h-0"
        data-camera-performance="true"
      >
        <div className="w-full max-w-[1380px] mx-auto lg:flex-1 lg:flex lg:flex-col lg:min-h-0">
          <Bento
            boardLive={boardLive}
            cameraEnabled={openModal === null}
            modalOpen={openModal !== null}
            onCameraChange={setSelectedCamera}
            onOpen={open}
          />
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
        <LiveModalContent selectedCamera={selectedCamera} onCameraChange={setSelectedCamera} />
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

    </main>
  )
}

function ModalLoading() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  return (
    <div className="space-y-3" aria-label="Loading modal content">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-2xl"
          style={{
            background: isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.045)',
            border: palette.cardBorder,
          }}
        />
      ))}
    </div>
  )
}

/* Header removed — bento itself is the page identity. The theme toggle
   floats in the top-right corner via CompactInner. */

/* ─────────────────────────── Bento ──────────────────────────── */

function Bento({
  boardLive,
  cameraEnabled,
  modalOpen,
  onCameraChange,
  onOpen,
}: {
  boardLive: boolean
  cameraEnabled: boolean
  modalOpen: boolean
  onCameraChange: (value: FieldCameraSource) => void
  onOpen: (key: ModalKey) => void
}) {
  return (
    <div
      className="grid gap-3 md:gap-4 mt-4 lg:mt-0 lg:flex-1 lg:min-h-0 [grid-auto-rows:auto] lg:grid-rows-4 lg:[grid-auto-rows:minmax(0,1fr)]"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      }}
    >
      {/* Spotlight spans two rows and keeps live camera streams paused until
          the visitor explicitly presses play. */}
      <div className="order-1 col-span-12 lg:order-none lg:col-span-3 lg:col-start-1 lg:row-start-1">
        <IdentityTile onOpen={() => onOpen('about')} />
      </div>

      <div className="order-2 col-span-12 lg:order-none lg:col-span-6 lg:col-start-4 lg:row-start-1 lg:row-span-2">
        <SpotlightTile
          enabled={cameraEnabled}
          modalOpen={modalOpen}
          onCameraChange={onCameraChange}
          onOpen={onOpen}
        />
      </div>

      <div className="order-7 col-span-12 lg:order-none lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:row-span-2">
        <SolarTile onOpen={() => onOpen('live')} />
      </div>

      <div className="order-6 col-span-12 lg:order-none lg:col-span-3 lg:col-start-1 lg:row-start-2">
        <StableSwapTile
          showLive={boardLive}
          live={<HealthTile onOpen={() => onOpen('live')} />}
          fallback={<EducationTile />}
        />
      </div>

      <div className="order-5 col-span-12 lg:order-none lg:col-span-5 lg:col-start-1 lg:row-start-3">
        <ExperienceTile onOpen={() => onOpen('experience')} />
      </div>
      <div className="order-4 col-span-12 lg:order-none lg:col-span-5 lg:col-start-1 lg:row-start-4">
        <ProjectsTile onOpen={() => onOpen('projects')} />
      </div>
      <div className="order-8 col-span-12 lg:order-none lg:col-span-4 lg:col-start-6 lg:row-start-3 lg:row-span-2">
        <MarathonTile onOpen={() => onOpen('marathon')} />
      </div>
      <div className="order-3 col-span-12 lg:order-none lg:col-span-3 lg:col-start-10 lg:row-start-3 lg:row-span-2">
        <ContactTile onOpen={() => onOpen('contact')} />
      </div>
    </div>
  )
}

/* ─────────────────── Stable live/fallback wrapper ──────────────────────── */

function StableSwapTile({
  showLive,
  live,
  fallback,
}: {
  showLive: boolean
  live: React.ReactNode
  fallback: React.ReactNode
}) {
  return <>{showLive ? live : fallback}</>
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
  const modalAriaLabel = modalLabel ?? (label ? `Open ${label}` : 'Open')
  const openFromTileChrome = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onOpen) return
    const target = event.target as HTMLElement | null
    const nestedInteractive = target?.closest('a, button, input, select, textarea, [role="button"], [role="link"]')
    if (nestedInteractive && nestedInteractive !== event.currentTarget) return
    haptic('open')
    onOpen()
  }
  const openFromTileKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen || event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    haptic('open')
    onOpen()
  }

  return (
    <div
      data-peek-target="true"
      data-card-hover={onOpen || deepLink ? 'true' : undefined}
      onClick={openFromTileChrome}
      onKeyDown={openFromTileKeyboard}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? modalAriaLabel : undefined}
      aria-haspopup={onOpen ? 'dialog' : undefined}
      className={`group relative z-[1] rounded-2xl overflow-hidden h-full flex flex-col ${onOpen || deepLink ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        boxShadow: palette.cardShadow,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Deep-link fallback when the tile is rendered outside modal mode.
          Modal mode uses the tile container itself as the accessible target,
          while nested links/buttons still win the click. */}
      {!onOpen && deepLink ? (
        <a
          href={deepLink}
          aria-label={label ? `Open ${label} on the full site` : 'Open on the full site'}
          className="absolute inset-0 z-0"
        />
      ) : null}
      {label && (
        <div
          className="relative z-10 px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-4 md:pt-[clamp(0.75rem,1.55dvh,1.25rem)] text-[10px] md:text-[clamp(8.5px,1.1dvh,10px)] font-semibold uppercase tracking-[0.22em] flex items-center justify-between pointer-events-none"
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
      className="min-h-[170px] lg:min-h-0"
    >
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] py-5 md:py-[clamp(0.75rem,1.7dvh,1.25rem)] gap-[clamp(0.35rem,1.05dvh,0.8rem)]">
        {/* Hero portrait — square card with a subtle ring + soft drop. */}
        <div className="flex justify-center flex-shrink-0">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              width: 'clamp(64px, min(9.2dvh, 7.2vw), 108px)',
              height: 'clamp(64px, min(9.2dvh, 7.2vw), 108px)',
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
          className="text-center text-[24px] md:text-[clamp(17px,2.2dvh,22px)] font-semibold leading-none tracking-tight max-w-full truncate"
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
          className="text-center text-[10.5px] md:text-[clamp(8.5px,1.05dvh,11px)] uppercase tracking-[0.18em] leading-none"
          style={{ color: palette.mutedText }}
        >
          Dallas, TX
        </div>
        <p
          className="max-w-[24ch] text-center text-[12px] md:text-[clamp(9px,1.08dvh,11.5px)] leading-snug tracking-tight"
          style={{ color: palette.bodyText }}
        >
          Hardware/software engineer building aircraft systems, edge AI,
          robotics, and iOS products.
        </p>

        <div className="flex justify-center flex-shrink-0">
          <a
            href="mailto:andrewsottiaux@gmail.com"
            className="relative z-10 inline-flex items-center gap-1.5 text-[12px] md:text-[clamp(10px,1.15dvh,12px)] font-semibold tracking-tight hover:gap-2 transition-all px-3 py-1.5 md:py-[clamp(0.25rem,0.7dvh,0.375rem)] rounded-full"
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

/* ───────────────────── Spotlight tile ──────────────────────── */

type SpotlightItem = {
  id: string
  kind: 'camera' | 'project'
  eyebrow: string
  title: string
  railLabel?: string
  subtitle: string
  description: string
  accent: { light: string; dark: string }
  halo?: { light: string; dark: string }
  modal: ModalKey
  camera?: FieldCameraSource
  icon?: string
  iconContain?: boolean
  href?: string
  cta?: string
}

const SPOTLIGHT_ROTATION_MS = 7000

const SPOTLIGHT_ITEMS: SpotlightItem[] = [
  {
    id: 'cam1',
    kind: 'camera',
    eyebrow: 'Clean live',
    title: 'Cam 1',
    subtitle: 'Edge-AI field camera',
    description: 'Live board telemetry, on-device inference, solar power, and health monitoring.',
    accent: { light: '#0a8aa8', dark: 'rgba(103, 232, 249, 0.9)' },
    modal: 'live',
    camera: 'field',
  },
  {
    id: 'cam2',
    kind: 'camera',
    eyebrow: 'PTZ relay',
    title: 'Cam 2',
    subtitle: 'Thingino pan / tilt',
    description: 'High-quality public relay with browser-safe controls and no Vercel video proxying.',
    accent: { light: '#10a366', dark: 'rgba(134, 239, 172, 0.92)' },
    modal: 'live',
    camera: 'thingino',
  },
  {
    id: 'travel-agent-ai',
    kind: 'project',
    eyebrow: 'Featured app',
    title: 'Travel Agent AI',
    railLabel: 'Travel',
    subtitle: 'AI-powered trip planner',
    description: 'Snap bookings, track flights, build packing lists, sync calendars, and share itineraries.',
    accent: { light: '#2563eb', dark: 'rgba(147, 197, 253, 0.95)' },
    halo: { light: 'rgba(37, 99, 235, 0.16)', dark: 'rgba(147, 197, 253, 0.18)' },
    modal: 'projects',
    icon: '/images/travelagentai-icon.png',
    href: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691',
    cta: 'App Store',
  },
  {
    id: 'wyzecar',
    kind: 'project',
    eyebrow: 'Robotics',
    title: 'WYZECAR',
    railLabel: 'WYZECAR',
    subtitle: 'Vision RC autonomy',
    description: 'YOLOv8 perception, browser controls, live video, and PID motion on a small RC platform.',
    accent: { light: '#b45309', dark: 'rgba(252, 211, 77, 0.95)' },
    halo: { light: 'rgba(180, 83, 9, 0.16)', dark: 'rgba(252, 211, 77, 0.18)' },
    modal: 'projects',
    icon: '/images/wyzecar.png',
    iconContain: true,
    href: 'https://github.com/Andy-Sottiaux/WYZECAR',
    cta: 'GitHub',
  },
]

function SpotlightTile({
  enabled,
  modalOpen,
  onCameraChange,
  onOpen,
}: {
  enabled: boolean
  modalOpen: boolean
  onCameraChange: (value: FieldCameraSource) => void
  onOpen: (key: ModalKey) => void
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const reducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [streamEnabled, setStreamEnabled] = useState(false)
  const [interactionPaused, setInteractionPaused] = useState(false)
  const active = SPOTLIGHT_ITEMS[activeIndex]

  useEffect(() => {
    setStreamEnabled(false)
  }, [active.id, enabled])

  useEffect(() => {
    if (reducedMotion || interactionPaused || modalOpen || streamEnabled) return

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % SPOTLIGHT_ITEMS.length)
    }, SPOTLIGHT_ROTATION_MS)

    return () => window.clearTimeout(timer)
  }, [activeIndex, interactionPaused, modalOpen, reducedMotion, streamEnabled])

  const selectSpotlight = (index: number) => {
    setActiveIndex(index)
    setStreamEnabled(false)

    const nextCamera = SPOTLIGHT_ITEMS[index]?.camera
    if (nextCamera) onCameraChange(nextCamera)
  }

  const openActive = () => {
    if (active.camera) onCameraChange(active.camera)
    onOpen(active.modal)
  }

  const startActiveCamera = () => {
    if (!active.camera) return
    onCameraChange(active.camera)
    setStreamEnabled(true)
  }

  const resumeAfterFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setInteractionPaused(false)
    }
  }

  return (
    <Tile
      label="Spotlight"
      accent={active.accent}
      deepLink="/#now"
      onOpen={openActive}
      modalLabel={`Open ${active.title}`}
      className="min-h-[310px] lg:min-h-0"
    >
      <div
        data-spotlight-motion="true"
        className="flex flex-1 min-h-0 flex-col"
        onPointerEnter={() => setInteractionPaused(true)}
        onPointerLeave={() => setInteractionPaused(false)}
        onFocusCapture={() => setInteractionPaused(true)}
        onBlurCapture={resumeAfterFocus}
      >
        <div className="relative flex-1 min-h-[230px] overflow-hidden">
          {SPOTLIGHT_ITEMS.map((item, index) => {
            const isActive = index === activeIndex
            return (
              <div
                key={item.id}
                aria-hidden={!isActive}
                className={`spotlight-slide absolute inset-0 ${isActive
                  ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto'
                  : 'opacity-0 translate-x-4 scale-[0.985] pointer-events-none'}`}
              >
                {item.kind === 'camera' ? (
                  <SpotlightCameraPanel
                    item={item}
                    active={isActive}
                    enabled={enabled}
                    streamEnabled={isActive && streamEnabled}
                    onStart={startActiveCamera}
                    onOpen={openActive}
                  />
                ) : (
                  <SpotlightProjectPanel
                    item={item}
                    active={isActive}
                    onOpen={onOpen}
                  />
                )}
              </div>
            )
          })}
        </div>

        <SpotlightRail
          items={SPOTLIGHT_ITEMS}
          activeIndex={activeIndex}
          onSelect={selectSpotlight}
          isLight={isLight}
          border={palette.cardBorder}
          muted={palette.mutedText}
        />
      </div>
    </Tile>
  )
}

function SpotlightCameraPanel({
  item,
  active,
  enabled,
  streamEnabled,
  onStart,
  onOpen,
}: {
  item: SpotlightItem
  active: boolean
  enabled: boolean
  streamEnabled: boolean
  onStart: () => void
  onOpen: () => void
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const camera = item.camera ?? 'field'

  return (
    <div className="h-full px-3 md:px-[clamp(0.75rem,1.15vw,1rem)] pt-2 md:pt-[clamp(0.35rem,1.0dvh,0.75rem)] pb-2 flex flex-col gap-2">
      <div
        className="relative w-full flex-1 min-h-[148px] overflow-hidden rounded-[14px]"
        style={{
          background: isLight ? '#0a0a0c' : '#000',
          border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isLight
            ? '0 4px 12px rgba(28,26,28,0.12)'
            : '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <CameraFeedSwitcher
          enabled={enabled && streamEnabled}
          fit="cover"
          selectedCamera={camera}
          onStart={active ? onStart : undefined}
        />
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full bg-black/58 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/82">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: item.accent.dark, boxShadow: `0 0 8px ${item.accent.dark}` }}
          />
          {item.eyebrow}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-black/54 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/72">
          {item.title}
        </div>
        {active && streamEnabled && (
          <button
            type="button"
            aria-label={`Expand ${item.title}`}
            onClick={(event) => {
              event.stopPropagation()
              haptic('open')
              onOpen()
            }}
            className="absolute right-3 bottom-3 z-20 flex h-8 w-8 items-center justify-center rounded-full text-white/82 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            style={{
              background: 'rgba(0,0,0,0.58)',
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
            </svg>
          </button>
        )}
      </div>
      <div className="min-w-0">
        <div
          className="truncate text-[18px] md:text-[clamp(14px,1.8dvh,18px)] font-semibold leading-tight tracking-tight"
          style={{ color: isLight ? '#1c1a1c' : '#fff' }}
        >
          {item.subtitle}
        </div>
        <p
          className="mt-0.5 line-clamp-1 text-[11px] md:text-[clamp(9px,1.1dvh,11px)] leading-tight"
          style={{ color: palette.bodyText }}
        >
          {item.description}
        </p>
      </div>
      <CameraSignalStrip selectedCamera={camera} streamEnabled={streamEnabled} />
    </div>
  )
}

function SpotlightProjectPanel({
  item,
  active,
  onOpen,
}: {
  item: SpotlightItem
  active: boolean
  onOpen: (key: ModalKey) => void
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const accent = isLight ? item.accent.light : item.accent.dark
  const halo = isLight ? item.halo?.light : item.halo?.dark

  return (
    <div className="h-full px-3 md:px-[clamp(0.75rem,1.15vw,1rem)] pt-2 md:pt-[clamp(0.35rem,1.0dvh,0.75rem)] pb-2">
      <div
        className="relative h-full min-h-0 overflow-hidden rounded-[14px] p-4 md:p-[clamp(0.9rem,1.7dvh,1.25rem)] flex flex-col justify-between"
        style={{
          background: isLight
            ? 'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(245,247,250,0.92))'
            : 'linear-gradient(135deg, rgba(19,22,28,0.98), rgba(9,10,13,0.98))',
          border: isLight ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isLight
            ? '0 4px 12px rgba(28,26,28,0.10)'
            : '0 8px 24px rgba(0,0,0,0.34)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full"
          style={{ background: `radial-gradient(circle, ${halo ?? 'rgba(255,255,255,0.12)'}, transparent 68%)` }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div
            className="relative h-16 w-16 md:h-[clamp(3.2rem,8dvh,4.75rem)] md:w-[clamp(3.2rem,8dvh,4.75rem)] flex-shrink-0 overflow-hidden rounded-2xl"
            style={{
              background: isLight ? '#fff' : 'rgba(255,255,255,0.94)',
              border: palette.cardBorder,
              boxShadow: isLight
                ? '0 10px 24px rgba(28,26,28,0.10)'
                : '0 14px 32px rgba(0,0,0,0.32)',
            }}
          >
            {item.icon ? (
              <Image
                src={item.icon}
                alt=""
                fill
                sizes="80px"
                className={item.iconContain ? 'object-contain p-1.5' : 'object-cover'}
              />
            ) : null}
          </div>
          <div
            className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]"
            style={{
              color: accent,
              background: isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)',
              border: palette.cardBorder,
            }}
          >
            {item.eyebrow}
          </div>
        </div>

        <div className="relative max-w-[30rem]">
          <div
            className="text-[30px] md:text-[clamp(24px,4.2dvh,40px)] font-semibold leading-[0.95] tracking-tight"
            style={{ color: isLight ? '#1c1a1c' : '#fff' }}
          >
            {item.title}
          </div>
          <div
            className="mt-2 text-[13px] md:text-[clamp(11px,1.55dvh,14px)] font-semibold tracking-tight"
            style={{ color: accent }}
          >
            {item.subtitle}
          </div>
          <p
            className="mt-2 max-w-[42ch] text-[12px] md:text-[clamp(10px,1.35dvh,13px)] leading-snug"
            style={{ color: palette.bodyText }}
          >
            {item.description}
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={active ? undefined : -1}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              style={{
                color: isLight ? '#fff' : '#081012',
                background: accent,
              }}
            >
              {item.cta ?? 'Open'}
            </a>
          ) : null}
          <button
            type="button"
            tabIndex={active ? undefined : -1}
            onClick={(event) => {
              event.stopPropagation()
              haptic('open')
              onOpen(item.modal)
            }}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            style={{
              color: palette.bodyText,
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',
              border: palette.cardBorder,
            }}
          >
            Details
          </button>
        </div>
      </div>
    </div>
  )
}

function SpotlightRail({
  items,
  activeIndex,
  onSelect,
  isLight,
  border,
  muted,
}: {
  items: SpotlightItem[]
  activeIndex: number
  onSelect: (index: number) => void
  isLight: boolean
  border: string
  muted: string
}) {
  return (
    <div
      className="grid grid-cols-4 gap-1 sm:gap-1.5 px-3 pb-3"
      role="tablist"
      aria-label="Featured spotlight"
    >
      {items.map((item, index) => {
        const active = index === activeIndex
        const accent = isLight ? item.accent.light : item.accent.dark

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Show ${item.title}`}
            onClick={(event) => {
              event.stopPropagation()
              haptic('tap')
              onSelect(index)
            }}
            className="min-w-0 rounded-full px-2 sm:px-2.5 py-1.5 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            style={{
              color: active ? accent : muted,
              background: active
                ? (isLight ? `${accent}14` : 'rgba(255,255,255,0.07)')
                : (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.035)'),
              border,
            }}
          >
            <span className="flex min-w-0 items-center gap-1 sm:gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: active ? accent : muted }}
              />
              <span className="truncate text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.08em] sm:tracking-[0.14em]">
                {item.railLabel ?? item.title}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CameraSignalStrip({
  selectedCamera,
  streamEnabled,
}: {
  selectedCamera: FieldCameraSource
  streamEnabled: boolean
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const cameraLabel = selectedCamera === 'field' ? 'Cam 1 · Edge AI' : 'Cam 2 · Thingino'
  const stateLabel = streamEnabled ? 'Live relay' : 'Paused'
  const stateColor = streamEnabled
    ? (isLight ? '#0f9d4f' : '#86efac')
    : palette.mutedText

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-full px-3 py-1.5 text-[9px] md:text-[clamp(7.5px,0.9dvh,9px)] font-semibold uppercase tracking-[0.16em]"
      style={{
        background: isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.045)',
        border: palette.cardBorder,
        color: palette.mutedText,
      }}
    >
      <span className="truncate">{cameraLabel}</span>
      <span className="flex items-center gap-1.5 whitespace-nowrap" style={{ color: stateColor }}>
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: stateColor,
            boxShadow: streamEnabled ? `0 0 8px ${stateColor}` : undefined,
          }}
        />
        {stateLabel}
      </span>
    </div>
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
        onClick={() => { haptic('open'); onOpen() }}
        aria-haspopup="dialog"
        aria-label="Open Field Live"
        data-card-hover="true"
        className="block w-full h-full min-h-[520px] sm:min-h-[430px] lg:min-h-0 [&>div]:h-full text-left"
      >
        <FieldSolarCard variant="compact" />
      </button>
    )
  }
  return (
    <a
      href="/#now"
      aria-label="Open Field Live on the full site"
      data-card-hover="true"
      className="block h-full min-h-[520px] sm:min-h-[430px] lg:min-h-0 [&>div]:h-full"
    >
      <FieldSolarCard variant="compact" />
    </a>
  )
}

/* ───────────────────── Health tile ──────────────────────── */

function HealthTile({ onOpen }: { onOpen?: () => void }) {
  if (onOpen) {
    return (
      <div
        data-card-hover="true"
        className="block w-full h-full min-h-[260px] lg:min-h-0 [&>div]:h-full text-left"
      >
        <FieldHealthCard variant="compact" />
      </div>
    )
  }
  return (
    <a
      href="/#now"
      aria-label="Open Field Live on the full site"
      data-card-hover="true"
      className="block h-full min-h-[260px] lg:min-h-0 [&>div]:h-full"
    >
      <FieldHealthCard variant="compact" />
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
      className="relative z-[1] rounded-2xl h-full min-h-[260px] lg:min-h-0 flex flex-col p-5 md:p-[clamp(1rem,1.8dvh,1.5rem)] overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        boxShadow: palette.cardShadow,
      }}
      data-peek-target="true"
      data-card-hover="true"
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
        className="text-[10px] md:text-[clamp(8.5px,1.1dvh,10px)] font-semibold uppercase tracking-[0.22em]"
        style={{ color: isLight ? '#cc0000' : '#ff7a7a' }}
      >
        Education
      </div>

      {/* Horizontal layout — logo on the left, text on the right. Fits a
          square slot far better than the previous vertically stacked one. */}
      <div className="relative flex-1 min-h-0 flex items-center gap-4 md:gap-[clamp(0.75rem,1.4dvh,1.25rem)]">
        <div
          className="flex items-center justify-center rounded-xl flex-shrink-0 p-2.5"
          style={{
            background: isLight ? '#fff' : 'rgba(255,255,255,0.96)',
            boxShadow: isLight
              ? '0 6px 18px rgba(28,26,28,0.10), 0 0 0 1px rgba(0,0,0,0.04)'
              : '0 10px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.15)',
            width: 'clamp(62px, 8dvh, 88px)',
            height: 'clamp(62px, 8dvh, 88px)',
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
            className="text-[15px] md:text-[clamp(12px,1.6dvh,16px)] font-semibold tracking-tight leading-tight"
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
            className="text-[12px] md:text-[clamp(10px,1.25dvh,12px)] tracking-tight mt-1"
            style={{ color: palette.bodyText }}
          >
            Texas Tech University · 2016
          </div>
          <div
            className="text-[11px] md:text-[clamp(9.5px,1.15dvh,11px)] tracking-tight mt-1 italic"
            style={{ color: palette.mutedText }}
          >
            Minor in Mathematics
          </div>
        </div>
      </div>

      <div
        className="text-[10px] md:text-[clamp(8.5px,1.05dvh,10px)] uppercase tracking-[0.18em] font-medium mt-auto text-center pt-3 md:pt-[clamp(0.4rem,1dvh,0.75rem)] border-t"
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
      className="relative z-[1] rounded-2xl h-full min-h-[170px] lg:min-h-0 flex flex-col p-6 md:p-[clamp(1rem,2dvh,1.75rem)] overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        boxShadow: palette.cardShadow,
      }}
      data-peek-target="true"
      data-card-hover="true"
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
      <div className="relative flex items-center justify-between mb-[clamp(0.35rem,1.2dvh,0.75rem)]">
        <div
          className="inline-flex items-center gap-2 text-[10px] md:text-[clamp(8.5px,1.05dvh,10px)] font-semibold uppercase tracking-[0.22em]"
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
          className="hidden lg:inline-flex items-center gap-1.5 text-[9.5px] md:text-[clamp(8px,0.95dvh,9.5px)] font-semibold uppercase tracking-[0.2em]"
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
          fontSize: 'clamp(20px, min(3.4vw, 4.5dvh), 34px)',
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
        className="relative text-[12.5px] md:text-[clamp(10.5px,1.3dvh,13px)] leading-snug tracking-tight mt-[clamp(0.35rem,1.1dvh,0.625rem)] max-w-[36ch]"
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
        className="relative mt-auto pt-[clamp(0.5rem,1.6dvh,1.25rem)] inline-flex items-center gap-1.5 text-[9.5px] md:text-[clamp(8px,0.95dvh,9.5px)] font-semibold uppercase tracking-[0.22em]"
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
      className="relative z-[1] rounded-2xl h-full min-h-[360px] lg:min-h-0 flex flex-col overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        boxShadow: palette.cardShadow,
      }}
      data-peek-target="true"
      data-card-hover="true"
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
        className="px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-4 md:pt-[clamp(0.75rem,1.55dvh,1.25rem)] text-[10px] md:text-[clamp(8.5px,1.1dvh,10px)] font-semibold uppercase tracking-[0.22em]"
        style={{ color: accent }}
      >
        More Projects
      </div>
      <div className="px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-3 md:pt-[clamp(0.45rem,1.1dvh,0.75rem)] pb-4 md:pb-[clamp(0.65rem,1.35dvh,1.25rem)] flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-[clamp(0.125rem,0.5dvh,0.55rem)]">
          {MORE_PROJECTS.map((p) => {
            const isCad = !!p.cad
            // Common chip + content the row renders, regardless of action.
            const chip = (
              <div
                className="rounded-[10px] overflow-hidden flex-shrink-0 flex items-center justify-center relative"
                style={{
                  width: 'clamp(30px,3.6dvh,40px)',
                  height: 'clamp(30px,3.6dvh,40px)',
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
                      className="text-[13px] md:text-[clamp(11px,1.35dvh,14px)] font-semibold leading-tight tracking-tight truncate"
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
                    className="text-[11px] md:text-[clamp(9.5px,1.15dvh,12px)] leading-tight tracking-tight truncate mt-0.5"
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
                  onClick={() => { haptic('open'); onOpen?.('airpodsmount') }}
                  className="group relative z-10 flex items-center gap-2.5 md:gap-3 py-[clamp(0.1rem,0.35dvh,0.375rem)] rounded-lg -mx-1 px-1 transition-colors text-left w-full"
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
                className="group relative z-10 flex items-center gap-2.5 md:gap-3 py-[clamp(0.1rem,0.35dvh,0.375rem)] rounded-lg -mx-1 px-1 transition-colors"
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
          className="relative z-10 mt-[clamp(0.25rem,0.7dvh,0.5rem)] pt-[clamp(0.25rem,0.7dvh,0.5rem)] inline-flex items-center gap-1 text-[10px] md:text-[clamp(9px,1.05dvh,11px)] tracking-tight border-t hover:opacity-100 opacity-70 transition-opacity"
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
    scale: 1.0,
  },
]

function ExperienceTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const logoSize = 'clamp(28px, 3.35dvh, 36px)'

  return (
    <Tile
      label="Experience"
      accent={{ light: '#0f9d4f', dark: 'rgb(74 222 128 / 0.9)' }}
      deepLink="/#experience"
      onOpen={onOpen}
      modalLabel="Open Experience"
      className="min-h-[200px] lg:min-h-0"
    >
      <div className="px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-2 md:pt-[clamp(0.25rem,0.9dvh,0.75rem)] pb-3 md:pb-[clamp(0.5rem,1.4dvh,1.25rem)] flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="h-full min-h-0 flex flex-col justify-between gap-[clamp(0.125rem,0.55dvh,0.625rem)]">
          {EXPERIENCE.map((e) => {
            return (
              <a
                key={e.company}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 group min-h-0 flex items-center justify-between gap-2 md:gap-3 py-[clamp(0.125rem,0.35dvh,0.375rem)] border-b last:border-b-0"
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
                      width: logoSize,
                      height: logoSize,
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
                      className="text-[13px] md:text-[clamp(11.5px,1.45dvh,14px)] font-semibold leading-none tracking-tight truncate"
                      style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                    >
                      {e.company}
                    </span>
                    <span
                      className="hidden lg:inline text-[12px] md:text-[clamp(10.5px,1.35dvh,13px)] leading-none tracking-tight truncate"
                      style={{ color: palette.bodyText }}
                    >
                      {e.title}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[11px] md:text-[clamp(10px,1.25dvh,12px)] leading-none tabular-nums tracking-tight flex-shrink-0 group-hover:opacity-100 opacity-80 transition-opacity"
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
  { name: 'Travel Agent AI', desc: 'AI trip-planning assistant · iOS', url: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691', icon: '/images/travelagentai-icon.png' },
  { name: 'WYZECAR', desc: 'Vision-based autonomous RC car · YOLOv8 · ROS2', url: 'https://github.com/Andy-Sottiaux/WYZECAR', icon: '/images/wyzecar.png', round: true },
  { name: 'Record + Transcribe', desc: 'Voice notes with AI summary · iOS', url: 'https://apps.apple.com/app/record-transcribe/id6758643630', icon: '/images/recordtranscribe-icon.png' },
]

function ProjectsTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const iconSize = 'clamp(30px, 3.55dvh, 36px)'

  return (
    <Tile
      label="Projects"
      accent={{ light: '#b45309', dark: 'rgba(252, 211, 77, 0.9)' }}
      deepLink="/#projects"
      onOpen={onOpen}
      modalLabel="Open Projects"
      className="min-h-[180px] lg:min-h-0"
    >
      <div className="px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-2 md:pt-[clamp(0.25rem,0.9dvh,0.75rem)] pb-3 md:pb-[clamp(0.5rem,1.4dvh,1.25rem)] flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col justify-evenly gap-[clamp(0.125rem,0.55dvh,0.625rem)]">
          {PROJECTS.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 group min-h-0 flex items-center gap-2.5 md:gap-3 py-[clamp(0.125rem,0.35dvh,0.375rem)]"
            >
              <div
                className="rounded-lg overflow-hidden flex-shrink-0"
                style={{
                  width: iconSize,
                  height: iconSize,
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
                  className="text-[13px] md:text-[clamp(11.5px,1.45dvh,14px)] font-semibold leading-tight tracking-tight truncate"
                  style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                >
                  {p.name}
                </div>
                <div
                  className="text-[11px] md:text-[clamp(10px,1.25dvh,12px)] leading-tight tracking-tight truncate"
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
          className="relative z-10 mt-[clamp(0.25rem,0.7dvh,0.5rem)] pt-[clamp(0.25rem,0.7dvh,0.5rem)] inline-flex items-center gap-1 text-[10px] md:text-[clamp(9.5px,1.15dvh,11px)] leading-none tracking-tight border-t hover:opacity-100 opacity-70 transition-opacity"
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
      className="relative z-[1] rounded-2xl h-full min-h-[180px] lg:min-h-0 overflow-hidden group"
      data-peek-target="true"
      data-card-hover="true"
      role="region"
      aria-label="2026 TCS NYC Marathon"
      style={{
        background: palette.cardBackground,
        // 1.5px TCS-orange outline + a soft warm halo just behind it so the
        // edge feels deliberate rather than thin.
        boxShadow: isLight
          ? '0 0 0 1.5px #E8642C, 0 8px 24px rgba(232,100,44,0.10), inset 0 1px 0 rgba(255,255,255,0.6)'
          : '0 0 0 1.5px #E8642C, 0 12px 32px rgba(232,100,44,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(24px))',
      }}
    >
      {/* Whole-tile clickable layer that opens the modal (sits behind the
          inner Donate button; foreground anchors capture clicks first). */}
      {onOpen && (
        <button
          type="button"
          onClick={() => { haptic('open'); onOpen() }}
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

      <div className="relative z-10 px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-4 md:pt-[clamp(0.75rem,1.55dvh,1rem)] pb-4 md:pb-[clamp(0.65rem,1.45dvh,1.25rem)] h-full min-h-0 flex flex-col gap-3 md:gap-[clamp(0.45rem,1.15dvh,1rem)]">
        <div className="flex items-start justify-between gap-4">
          <div
            className="inline-flex items-center justify-center rounded-xl px-3 py-2 md:px-[clamp(0.55rem,1.1dvh,0.75rem)] md:py-[clamp(0.35rem,0.9dvh,0.5rem)] self-start"
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
              className="h-14 md:h-[clamp(42px,7dvh,64px)] w-auto object-contain"
            />
          </div>

          <div
            className="text-[10px] md:text-[clamp(8.5px,1.05dvh,10px)] font-bold uppercase tracking-[0.2em] px-2 py-1 md:py-[clamp(0.2rem,0.55dvh,0.25rem)] rounded-full flex-shrink-0"
            style={{
              background: isLight ? 'rgba(232,100,44,0.10)' : 'rgba(232,100,44,0.18)',
              color: isLight ? '#c63d1f' : '#ff8a4a',
              border: isLight ? '1px solid rgba(232,100,44,0.25)' : '1px solid rgba(232,100,44,0.35)',
            }}
          >
            Nov 1, 2026
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-[clamp(0.75rem,1.6dvh,1.25rem)]">
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 rounded-full self-center flex-shrink-0"
                style={{
                  background: '#E8642C',
                  boxShadow: '0 0 10px rgba(232,100,44,0.7)',
                  animation: 'fldMarathonPulse 1.8s ease-in-out infinite',
                }}
              />
              <div
                className="text-[40px] md:text-[clamp(36px,6.2dvh,52px)] font-bold leading-none tracking-tight tabular-nums"
                style={{ color: numberColor }}
              >
                {days ?? '—'}
              </div>
              <div
                className="text-[12px] md:text-[clamp(10px,1.35dvh,13px)] font-bold uppercase tracking-[0.22em] pb-1.5"
                style={{ color: subtleText }}
              >
                Days
              </div>
            </div>
            <div className="text-[11.5px] md:text-[clamp(9.5px,1.25dvh,12px)] tracking-tight mt-2 md:mt-[clamp(0.25rem,0.8dvh,0.5rem)]" style={{ color: subtleText }}>
              Running for <span className="font-semibold" style={{ color: numberColor }}>Team for Kids</span> · NYRR
            </div>
          </div>

          <a
            href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Scan or tap to donate"
            className="relative z-10 self-start sm:self-center group flex-shrink-0"
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
                sizes="(max-width: 639px) 88px, 116px"
              />
              <span aria-hidden="true" className="absolute -top-[3px] -left-[3px] w-3 h-3 border-t-2 border-l-2 rounded-tl-md" style={{ borderColor: '#E8642C' }} />
              <span aria-hidden="true" className="absolute -top-[3px] -right-[3px] w-3 h-3 border-t-2 border-r-2 rounded-tr-md" style={{ borderColor: '#E8642C' }} />
              <span aria-hidden="true" className="absolute -bottom-[3px] -left-[3px] w-3 h-3 border-b-2 border-l-2 rounded-bl-md" style={{ borderColor: '#E8642C' }} />
              <span aria-hidden="true" className="absolute -bottom-[3px] -right-[3px] w-3 h-3 border-b-2 border-r-2 rounded-br-md" style={{ borderColor: '#E8642C' }} />
            </div>
            <div
              className="mt-1.5 md:mt-[clamp(0.25rem,0.75dvh,0.375rem)] text-[9.5px] md:text-[clamp(8px,0.95dvh,9.5px)] font-bold uppercase tracking-[0.2em] text-center inline-flex items-center justify-center gap-1 w-full"
              style={{ color: isLight ? '#c63d1f' : '#ff8a4a' }}
            >
              Scan · Donate
              <svg className="w-2.5 h-2.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        </div>

        <div className="pt-1 md:pt-[clamp(0.25rem,0.75dvh,0.5rem)] mt-auto">
          <div className="h-2.5 md:h-[clamp(0.4rem,0.9dvh,0.625rem)] w-full rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
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
          <div className="flex items-baseline justify-between mt-2 md:mt-[clamp(0.35rem,0.9dvh,0.5rem)]">
            <div className="text-[13px] md:text-[clamp(10.5px,1.35dvh,13px)] font-bold tabular-nums tracking-tight" style={{ color: numberColor }}>
              ${raised.toLocaleString()}
              <span className="font-medium ml-1" style={{ color: subtleText }}>
                / ${goal.toLocaleString()}
              </span>
            </div>
            <div className="text-[10.5px] md:text-[clamp(8.5px,1.05dvh,10.5px)] font-semibold uppercase tracking-[0.18em]" style={{ color: subtleText }}>
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
      className="min-h-[180px] lg:min-h-0"
    >
      <div className="px-5 md:px-[clamp(0.9rem,1.45vw,1.25rem)] pt-3 md:pt-[clamp(0.35rem,1dvh,0.75rem)] pb-3 md:pb-[clamp(0.45rem,1.1dvh,0.75rem)] flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-2 gap-2 md:gap-[clamp(0.35rem,0.95dvh,0.5rem)] flex-1 min-h-0">
          {CONTACTS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target={c.href.startsWith('mailto:') ? undefined : '_blank'}
              rel={c.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
              className="relative z-10 flex items-center justify-center gap-2 md:gap-[clamp(0.35rem,0.8dvh,0.5rem)] px-2 py-2 md:py-[clamp(0.35rem,1.0dvh,0.5rem)] rounded-xl transition-all hover:scale-[1.02] min-h-0"
              style={{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                border: palette.cardBorder,
                color: isLight ? '#1c1a1c' : '#fff',
              }}
            >
              <div className="w-[17px] h-[17px] md:w-[clamp(13px,1.8dvh,17px)] md:h-[clamp(13px,1.8dvh,17px)] opacity-90 flex-shrink-0">{c.icon}</div>
              <div className="text-[11px] md:text-[clamp(9.5px,1.15dvh,11px)] font-semibold tracking-tight truncate">{c.label}</div>
            </a>
          ))}
        </div>
        <div
          className="mt-2 md:mt-[clamp(0.3rem,0.9dvh,0.5rem)] text-[9px] md:text-[clamp(7.5px,0.9dvh,9px)] tracking-wide text-center"
          style={{ color: palette.fadedText }}
        >
          © {new Date().getFullYear()} Andy Sottiaux
        </div>
      </div>
    </Tile>
  )
}
