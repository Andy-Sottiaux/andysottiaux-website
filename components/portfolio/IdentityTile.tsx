'use client'

import Image from 'next/image'
import { useFieldTheme } from '../fieldTheme'
import Tile from './Tile'

/* ───────────────────── Identity tile ──────────────────────── */

export default function IdentityTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      deepLink="/#about"
      onOpen={onOpen}
      modalLabel="Open About"
      className="min-h-[170px] lg:min-h-0"
    >
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 sm:px-7 md:px-[clamp(1rem,1.7vw,1.5rem)] py-8 sm:py-8 md:py-[clamp(0.75rem,1.7dvh,1.25rem)] gap-2.5 sm:gap-3 md:gap-[clamp(0.35rem,1.05dvh,0.8rem)]">
        {/* Hero portrait — square card with a subtle ring + soft drop. */}
        <div className="flex justify-center flex-shrink-0">
          <div
            className="relative h-[112px] w-[112px] overflow-hidden rounded-[22px] sm:h-[124px] sm:w-[124px] md:h-[clamp(64px,min(9.2dvh,7.2vw),108px)] md:w-[clamp(64px,min(9.2dvh,7.2vw),108px)] md:rounded-2xl"
            style={{
              boxShadow: isLight
                ? '0 12px 32px rgba(28,26,28,0.18), 0 0 0 1px rgba(0,0,0,0.05)'
                : '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <Image
              src="/images/andy-casual-headshot-2026.webp"
              alt="Andy Sottiaux"
              fill
              sizes="(max-width: 639px) 112px, (max-width: 767px) 124px, 116px"
              className="object-cover"
              priority
            />
          </div>
        </div>

        <h1
          className="max-w-full truncate text-center text-[32px] font-semibold leading-none tracking-tight sm:text-[34px] md:text-[clamp(17px,2.2dvh,22px)]"
          style={{
            backgroundImage: palette.headlineGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Andy Sottiaux
        </h1>
        <div
          className="text-center text-[12px] uppercase leading-none tracking-[0.18em] sm:text-[12.5px] md:text-[clamp(8.5px,1.05dvh,11px)]"
          style={{ color: palette.mutedText }}
        >
          Dallas, TX
        </div>
        <p
          className="max-w-[30ch] text-center text-[15px] leading-snug tracking-tight sm:text-[15.5px] md:max-w-[24ch] md:text-[clamp(9px,1.08dvh,11.5px)]"
          style={{ color: palette.bodyText }}
        >
          Hardware/software engineer building aircraft systems, edge AI,
          robotics, and iOS products.
        </p>

        <div className="flex justify-center flex-shrink-0">
          <a
            href="mailto:andrewsottiaux@gmail.com"
            className="relative z-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold tracking-tight transition-all hover:gap-2.5 sm:text-[16px] md:gap-1.5 md:px-3 md:py-[clamp(0.25rem,0.7dvh,0.375rem)] md:text-[clamp(10px,1.15dvh,12px)] md:hover:gap-2"
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
