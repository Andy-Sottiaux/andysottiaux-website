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
      triggerClassName="lg:left-2 lg:right-auto lg:top-1 2xl:left-auto 2xl:right-3 2xl:top-3"
    >
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 sm:px-7 md:px-[clamp(1rem,1.7vw,1.5rem)] py-8 sm:py-8 md:py-[clamp(0.75rem,1.7dvh,1.25rem)] gap-2.5 sm:gap-3 md:gap-[clamp(0.35rem,1.05dvh,0.8rem)] lg:flex-row lg:gap-2 lg:px-2 lg:py-1 xl:gap-3 xl:px-4">
        {/* Hero portrait — square card with a subtle ring + soft drop. */}
        <div className="flex justify-center flex-shrink-0">
          <div
            className="relative h-[112px] w-[112px] overflow-hidden rounded-[22px] sm:h-[124px] sm:w-[124px] md:h-[clamp(64px,min(9.2dvh,7.2vw),108px)] md:w-[clamp(64px,min(9.2dvh,7.2vw),108px)] md:rounded-2xl lg:h-[clamp(64px,min(13.5dvh,9vw),144px)] lg:w-[clamp(64px,min(13.5dvh,9vw),144px)] lg:rounded-[22px]"
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
              sizes="(max-width: 639px) 112px, (max-width: 767px) 124px, (max-width: 1023px) 108px, 144px"
              className="object-cover"
              priority
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-2.5 sm:gap-3 md:gap-[clamp(0.35rem,1.05dvh,0.8rem)] lg:flex-1 lg:items-start lg:gap-0.5">
          <h1
            className="max-w-full text-center text-[32px] font-semibold leading-none tracking-tight sm:text-[34px] lg:text-left lg:text-lg lg:leading-tight xl:text-xl"
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
            className="text-center text-xs uppercase leading-tight tracking-[0.12em] lg:text-left"
            style={{ color: palette.mutedText }}
          >
            Dallas, TX
          </div>
          <p
            className="max-w-[30ch] text-center text-base leading-snug tracking-tight lg:max-w-none lg:text-left lg:text-sm"
            style={{ color: palette.bodyText }}
          >
            Hardware + software engineer.
          </p>

          <div className="flex flex-shrink-0 justify-center lg:justify-start">
            <a
              href="mailto:andrewsottiaux@gmail.com"
              className="relative z-10 inline-flex min-h-8 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-base font-semibold tracking-tight transition-all hover:gap-2.5 lg:gap-1 lg:px-1.5 lg:py-1 lg:text-xs xl:px-2 xl:text-sm"
              style={{
                color: isLight ? '#0a8aa8' : 'rgb(103, 232, 249)',
                background: isLight
                  ? 'rgba(10, 138, 168, 0.08)'
                  : 'rgba(103, 232, 249, 0.08)',
              }}
            >
              Get in touch
              <svg className="w-3.5 h-3.5 lg:hidden 2xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </Tile>
  )
}
