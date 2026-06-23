'use client'

import Image from 'next/image'
import { useFieldTheme } from '../fieldTheme'

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
export default function EducationTile() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div
      className="relative z-[1] rounded-2xl h-full min-h-[260px] lg:min-h-0 flex flex-col p-5 md:p-[clamp(1rem,1.8dvh,1.5rem)] overflow-hidden"
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'var(--field-card-backdrop-filter, blur(8px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(8px))',
        boxShadow: palette.cardShadow,
      }}
      data-peek-target="true"
      data-card-hover="true"
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
