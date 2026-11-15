'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useFieldTheme } from '../fieldTheme'
import { MARATHON_DATE, NYC_2026_RESULT } from './content'
import { haptic } from '@/lib/haptics'
import { useFundraising } from '@/lib/useFundraising'

/* ───────────────────── Marathon tile ──────────────────────── */

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

export default function MarathonTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const days = useDaysUntil(MARATHON_DATE)
  const { raised, goal } = useFundraising()

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
      aria-label="2027 Bank of America Chicago Marathon"
      style={{
        background: palette.cardBackground,
        // 1.5px TCS-orange outline + a soft warm halo just behind it so the
        // edge feels deliberate rather than thin.
        boxShadow: isLight
          ? '0 0 0 1.5px #E8642C, 0 8px 24px rgba(232,100,44,0.10), inset 0 1px 0 rgba(255,255,255,0.6)'
          : '0 0 0 1.5px #E8642C, 0 12px 32px rgba(232,100,44,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'var(--field-card-backdrop-filter, blur(8px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(8px))',
      }}
    >
      {/* Whole-tile clickable layer that opens the modal. The content above it
          is not interactive and lets clicks through. */}
      {onOpen && (
        <button
          type="button"
          onClick={() => { haptic('open'); onOpen() }}
          aria-label="Open 2027 Chicago Marathon and 2026 NYC Marathon result"
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

      <div className="pointer-events-none relative z-10 px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-4 md:pt-[clamp(0.75rem,1.55dvh,1rem)] pb-4 md:pb-[clamp(0.65rem,1.45dvh,1.25rem)] h-full min-h-0 flex flex-col gap-3 md:gap-[clamp(0.45rem,1.15dvh,1rem)]">
        <div className="flex items-start justify-between gap-4">
          <div
            className="inline-flex items-center justify-center rounded-xl px-3 py-2 md:px-[clamp(0.55rem,1.1dvh,0.75rem)] md:py-[clamp(0.35rem,0.9dvh,0.5rem)] self-start"
            style={{
              background: '#0b1626',
              boxShadow: '0 6px 18px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            <Image
              src="/images/chicago-marathon-white.png"
              alt="2027 Bank of America Chicago Marathon"
              width={900}
              height={168}
              className="h-7 md:h-[clamp(22px,3.8dvh,34px)] w-auto object-contain"
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
            Oct 10, 2027
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
                  animation: 'fldMarathonPulse 0.9s ease-in-out infinite',
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
              Until the <span className="font-semibold" style={{ color: numberColor }}>Chicago Marathon</span>
            </div>
          </div>

          <div className="relative z-10 self-start sm:self-center flex-shrink-0 sm:text-right">
            <div
              className="text-[9.5px] md:text-[clamp(8px,0.95dvh,9.5px)] font-bold uppercase tracking-[0.2em]"
              style={{ color: isLight ? '#c63d1f' : '#ff8a4a' }}
            >
              NYC 2026 · Finished
            </div>
            <div
              className="text-[28px] md:text-[clamp(22px,3.9dvh,34px)] font-bold leading-none tracking-tight tabular-nums mt-1"
              style={{ color: numberColor }}
            >
              {NYC_2026_RESULT.time}
            </div>
            <div className="text-[11.5px] md:text-[clamp(9.5px,1.25dvh,12px)] tracking-tight mt-1" style={{ color: subtleText }}>
              TCS NYC Marathon · {NYC_2026_RESULT.pace} / mi
            </div>
          </div>
        </div>

        <div className="pt-1 md:pt-[clamp(0.25rem,0.75dvh,0.5rem)] mt-auto">
          <div className="h-2.5 md:h-[clamp(0.4rem,0.9dvh,0.625rem)] w-full rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
            <div
              className="h-full rounded-full relative overflow-hidden"
              style={{
                width: '100%',
                transform: `scaleX(${pct / 100})`,
                transformOrigin: 'left',
                background: 'linear-gradient(90deg, #E8642C 0%, #ffb84d 100%)',
                boxShadow: '0 0 14px rgba(232,100,44,0.45)',
                transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                  animation: 'fldMarathonShimmer 0.9s linear infinite',
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
              Team for Kids · NYC 2026
            </div>
          </div>
        </div>
      </div>

      <style>{`
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
