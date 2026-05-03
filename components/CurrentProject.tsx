'use client'

/**
 * CurrentProject — home-page live status section.
 *
 * Job: in five seconds, communicate "there's a real, live system out
 * there, and here are its vitals". Three live cards (Solar · Camera ·
 * Health) drive the message.
 *
 * Visual language: cinematic, Apple-product-page. Generous vertical
 * rhythm. Big gradient typography. Soft cyan/amber/emerald accents matched
 * to telemetry. No marketing prose; the live data does the talking.
 *
 * Theme: dark mode is a navy → near-black gradient with white-glass cards.
 * Light mode is a calm bone-on-cream gradient with white-glass cards on
 * warm/cool ambient glows. Live-data accent colors (emerald/cyan/amber)
 * stay constant across themes.
 */

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import FieldHealthCard from './FieldHealthCard'
import FieldSolarCard from './FieldSolarCard'
import { FieldThemeProvider, useFieldTheme } from './fieldTheme'
import { useReducedMotion } from '@/lib/useReducedMotion'

// Dynamic import — the camera feed polls a same-origin snapshot proxy
// from the browser; SSR'ing it is wasted work, so skip it server-side.
const FieldCameraFeed = dynamic(() => import('./FieldCameraFeed'), {
  ssr: false,
  loading: () => <CameraLoadingShimmer />,
})

function CameraLoadingShimmer() {
  // Mode-aware skeleton so the placeholder doesn't fight the theme around it.
  const { mode } = useFieldTheme()
  return (
    <div
      className="absolute inset-0 rounded-2xl"
      style={{
        background:
          mode === 'dark'
            ? 'linear-gradient(105deg, #0a0a0c 25%, #16161a 50%, #0a0a0c 75%)'
            : 'linear-gradient(105deg, #ececef 25%, #f6f6f8 50%, #ececef 75%)',
        backgroundSize: '200% 100%',
        animation: 'fldShimmer 2.4s linear infinite',
      }}
    />
  )
}

// IntersectionObserver-based scroll reveal. Reduced-motion users get the
// final state immediately.
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
    <FieldThemeProvider>
      <CurrentProjectInner />
    </FieldThemeProvider>
  )
}

function CurrentProjectInner() {
  const palette = useFieldTheme()
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
                animation: 'fldEyebrowPulse 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
              }}
              aria-hidden="true"
            />
            Field Live
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

        {/* Three live cards. */}
        <Reveal delay={0.15} className="mt-12 sm:mt-16">
          <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-3">

            {/* SOLAR */}
            <div className="md:col-span-1">
              <FieldSolarCard />
            </div>

            {/* CAMERA — middle, the visual centerpiece */}
            <div className="md:col-span-1">
              <CameraCardShell />
            </div>

            {/* HEALTH */}
            <div className="md:col-span-1">
              <FieldHealthCard />
            </div>
          </div>
        </Reveal>

        {/* Footer note — no project-identifying CTAs. */}
        <Reveal delay={0.3}>
          <div
            className="mt-12 sm:mt-16 text-center text-[13px] tracking-tight"
            style={{ color: palette.fadedText }}
          >
            Live from the field. More details on request.
          </div>
        </Reveal>
      </div>

      <style jsx global>{`
        @keyframes fldEyebrowPulse {
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
  const palette = useFieldTheme()
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
          <FieldCameraFeed />
        </div>
      </div>

      {/* Footer copy */}
      <div className="px-7 md:px-8 pt-5 pb-7 md:pb-8 mt-auto">
        <div
          className="text-[13px] tracking-tight leading-snug"
          style={{ color: palette.bodyText }}
        >
          Live edge-AI camera. Public read-only stream.
        </div>
      </div>
    </div>
  )
}
