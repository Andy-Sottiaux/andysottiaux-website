'use client'

/**
 * CurrentProject — home-page Cayley teaser / live status dashboard.
 *
 * Job: in five seconds, communicate "what is this thing, why does it
 * matter, is it alive right now". Three live cards (Solar · Camera ·
 * Health) drive the message. The full product tour lives at /cayley.
 *
 * Visual language: cinematic, Apple-product-page. Generous vertical
 * rhythm. Big gradient typography. Soft cyan/amber/emerald accents matched
 * to telemetry. No marketing prose; the live data does the talking.
 *
 * Theme: dark mode is the original navy → near-black gradient with
 * white-glass cards. Light mode is a calm bone-on-cream gradient with
 * white-glass cards on warm/cool ambient glows. Live-data accent colors
 * (emerald/cyan/amber) stay constant across themes.
 */

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import CayleyHealthCard from './CayleyHealthCard'
import CayleySolarCard from './CayleySolarCard'
import { CayleyThemeProvider, useCayleyTheme } from './cayleyTheme'
import { useReducedMotion } from '@/lib/useReducedMotion'

// Dynamic import — WebRTC + RTCPeerConnection are browser-only and the
// component pulls roughly nothing on the server, so SSR-skip it.
const CayleyCameraFeed = dynamic(() => import('./CayleyCameraFeed'), {
  ssr: false,
  loading: () => <CameraLoadingShimmer />,
})

function CameraLoadingShimmer() {
  // Mode-aware skeleton so the placeholder doesn't fight the theme around it.
  const { mode } = useCayleyTheme()
  return (
    <div
      className="absolute inset-0 rounded-2xl"
      style={{
        background:
          mode === 'dark'
            ? 'linear-gradient(105deg, #0a0a0c 25%, #16161a 50%, #0a0a0c 75%)'
            : 'linear-gradient(105deg, #ececef 25%, #f6f6f8 50%, #ececef 75%)',
        backgroundSize: '200% 100%',
        animation: 'cayShimmer 2.4s linear infinite',
      }}
    />
  )
}

// IntersectionObserver-based scroll reveal. Mirrors CayleyPlatform.tsx so
// the home section feels like a sibling of the deep tour without copying
// its weight. Reduced-motion users get the final state immediately.
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) {
      setShown(true)
      return
    }
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
  }, [reduced])
  return { ref, shown, reduced }
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, shown, reduced } = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translate3d(0,0,0)' : 'translate3d(0, 28px, 0)',
        transition: reduced
          ? 'none'
          : 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: reduced ? '0s' : `${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

export default function CurrentProject() {
  return (
    <CayleyThemeProvider>
      <CurrentProjectInner />
    </CayleyThemeProvider>
  )
}

function CurrentProjectInner() {
  const palette = useCayleyTheme()
  const isLight = palette.mode === 'light'

  return (
    <section
      id="now"
      className="relative overflow-hidden"
      style={{
        background: palette.sectionBackground,
        color: isLight ? '#1c1a1c' : '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <div className="px-5 sm:px-6 py-24 sm:py-32 md:py-40 max-w-6xl mx-auto">

        {/* Eyebrow + title */}
        <Reveal>
          <div
            className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] mb-6"
            style={{ color: isLight ? '#0f9d4f' : 'rgb(74 222 128 / 0.9)' /* emerald-400/90 */ }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#30d158',
                boxShadow: '0 0 10px #30d158',
                animation: 'cayEyebrowPulse 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
              }}
              aria-hidden="true"
            />
            Cayley · Live
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <h2
            className="font-semibold leading-[1.02] tracking-tight max-w-4xl"
            style={{
              fontSize: 'clamp(40px, 7vw, 88px)',
              background: palette.headlineGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Sun goes in.<br />Vision comes out.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p
            className="text-[17px] sm:text-[19px] mt-6 max-w-2xl leading-snug tracking-tight"
            style={{ color: palette.bodyText }}
          >
            A solar-powered Linux board running a 5&nbsp;MP camera, an on-chip neural engine,
            and a public API. Built end-to-end. Live, right now.
          </p>
        </Reveal>

        {/* Three live cards. On md+, a 12-col grid lets the camera card
            be a touch wider than the side cards (5/4/3 doesn't quite work
            with our content; 4/4/4 is the cleaner read). */}
        <Reveal delay={0.15} className="mt-12 sm:mt-16">
          <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-3">

            {/* SOLAR */}
            <div className="md:col-span-1">
              <CayleySolarCard />
            </div>

            {/* CAMERA — middle, the visual centerpiece */}
            <div className="md:col-span-1">
              <CameraCardShell />
            </div>

            {/* HEALTH */}
            <div className="md:col-span-1">
              <CayleyHealthCard />
            </div>
          </div>
        </Reveal>

        {/* Topology line — minimal, elegant. Only shown on sm+ so the
            mobile layout stays tight. */}
        <Reveal delay={0.25}>
          <div
            className="hidden sm:flex items-center justify-center gap-3 mt-10 text-[12px] font-medium tracking-wide"
            style={{ color: palette.fadedText }}
          >
            <TopologyDot label="board" />
            <TopologyLine />
            <TopologyDot label="tailnet" />
            <TopologyLine />
            <TopologyDot label="public HTTPS" emphasis />
          </div>
        </Reveal>

        {/* Deep-tour link */}
        <Reveal delay={0.3}>
          <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <a
              href="/cayley"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-semibold transition-all"
              style={{
                background: isLight ? '#1c1a1c' : 'rgba(255,255,255,0.95)',
                color: isLight ? '#fff' : '#000',
                boxShadow: isLight
                  ? '0 8px 24px rgba(28,26,28,0.18)'
                  : '0 8px 24px rgba(0,0,0,0.25)',
              }}
            >
              Read the full story
              <span
                className="transition-transform"
                style={{ display: 'inline-block' }}
                aria-hidden="true"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </span>
            </a>
            <a
              href="https://github.com/Andy-Sottiaux/SolarCamera"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full text-[14px] font-medium transition-all"
              style={{
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.12)',
                color: isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
              </svg>
              Source on GitHub
            </a>
          </div>
        </Reveal>
      </div>

      <style jsx global>{`
        @keyframes cayEyebrowPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(48,209,88,0.7); }
          50%      { box-shadow: 0 0 18px rgba(48,209,88,1);   }
        }
      `}</style>
    </section>
  )
}

function CameraCardShell() {
  // Card chrome around the camera component itself. Keeps the visual
  // weight matched to the side cards while letting the video bleed to
  // the rounded edge.
  const palette = useCayleyTheme()
  const isLight = palette.mode === 'light'

  return (
    <div
      className="relative rounded-2xl h-full flex flex-col overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: palette.cardShadow,
      }}
    >
      {/* Header strip */}
      <div className="px-7 md:px-8 pt-7 md:pt-8 pb-5">
        <div
          className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: isLight ? '#0a8aa8' : 'rgba(103, 232, 249, 0.9)' /* cyan-300/90 */ }}
        >
          Camera
        </div>
      </div>

      {/* Video — 16:9, fills width */}
      <div className="relative px-3 sm:px-4">
        <div
          className="relative w-full overflow-hidden rounded-[16px]"
          style={{
            aspectRatio: '16 / 9',
            background: isLight ? '#0a0a0c' : '#000',
            boxShadow: isLight
              ? '0 4px 12px rgba(28,26,28,0.12)'
              : '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <CayleyCameraFeed />
        </div>
      </div>

      {/* Footer copy */}
      <div className="px-7 md:px-8 pt-5 pb-7 md:pb-8 mt-auto">
        <div
          className="text-[13px] tracking-tight leading-snug"
          style={{ color: palette.bodyText }}
        >
          5&nbsp;MP H.265 over WebRTC. Streamed from the board over Tailscale Funnel — no port forwarding, public HTTPS.
        </div>
      </div>
    </div>
  )
}

function TopologyDot({ label, emphasis = false }: { label: string; emphasis?: boolean }) {
  const palette = useCayleyTheme()
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: emphasis ? '#30d158' : palette.mutedText,
          boxShadow: emphasis ? '0 0 8px #30d158' : 'none',
        }}
      />
      <span style={{ color: emphasis ? (palette.mode === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)') : undefined }}>
        {label}
      </span>
    </span>
  )
}

function TopologyLine() {
  const palette = useCayleyTheme()
  const stops = palette.mode === 'light'
    ? 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.18), rgba(0,0,0,0.06))'
    : 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.25), rgba(255,255,255,0.08))'
  return (
    <span
      className="inline-block w-12"
      style={{ height: 1, background: stops }}
      aria-hidden="true"
    />
  )
}
