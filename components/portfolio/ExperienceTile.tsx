'use client'

import Image from 'next/image'
import { useFieldTheme } from '../fieldTheme'
import { EXPERIENCE_ITEMS } from './content'
import Tile from './Tile'

/* ───────────────────── Experience tile ──────────────────────── */

export default function ExperienceTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Experience"
      accent={{ light: '#0f9d4f', dark: 'rgb(74 222 128 / 0.9)' }}
        deepLink="/#experience"
        onOpen={onOpen}
        modalLabel="Open Experience"
        className="min-h-[285px] sm:min-h-[250px] lg:min-h-0"
      >
        <div className="px-4 sm:px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-2 md:pt-[clamp(0.25rem,0.9dvh,0.75rem)] pb-3 md:pb-[clamp(0.5rem,1.4dvh,1.25rem)] flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="h-full min-h-0 flex flex-col justify-between gap-2 lg:gap-[clamp(0.1rem,0.45dvh,0.4rem)]">
            {EXPERIENCE_ITEMS.map((e) => {
              return (
                <a
                  key={e.company}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 group min-h-0 flex items-center justify-between gap-2.5 md:gap-3 rounded-xl px-2.5 py-2 lg:px-[clamp(0.35rem,0.75dvh,0.55rem)] lg:py-[clamp(0.1rem,0.32dvh,0.3rem)] transition-all"
                  style={{
                    background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.035)',
                    border: palette.hairline ? `1px solid ${palette.hairline}` : palette.cardBorder,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Logo chip — uniform 36×36 square plate. Per-logo
                      `scale` compensates for differing native whitespace
                      so each mark reads at roughly the same visual weight
                      inside the same-sized plate. */}
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0 overflow-hidden lg:h-[clamp(28px,3.35dvh,36px)] lg:w-[clamp(28px,3.35dvh,36px)] lg:rounded-md"
                      style={{
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

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span
                          className="text-[13px] md:text-[clamp(11.5px,1.45dvh,14px)] font-semibold leading-tight tracking-tight truncate"
                          style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                        >
                          {e.company}
                        </span>
                        <span
                          className="hidden sm:inline text-[11px] md:text-[clamp(10px,1.2dvh,11px)] leading-none tabular-nums tracking-tight flex-shrink-0 opacity-80"
                          style={{ color: palette.mutedText }}
                        >
                          {e.period}
                        </span>
                      </div>
                      <span
                        className="mt-0.5 block text-[11.5px] md:text-[clamp(10px,1.25dvh,12px)] leading-tight tracking-tight truncate lg:hidden"
                        style={{ color: palette.bodyText }}
                      >
                        {e.title}
                      </span>
                    </div>
                  </div>
                  <span
                    className="sm:hidden text-[10.5px] leading-none tabular-nums tracking-tight flex-shrink-0 group-hover:opacity-100 opacity-75 transition-opacity"
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
