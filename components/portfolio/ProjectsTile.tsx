'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useFieldTheme } from '../fieldTheme'
import { PROJECT_ITEMS } from './content'
import Tile from './Tile'

/* ───────────────────── Projects tile ──────────────────────── */

export default function ProjectsTile({ onOpen }: { onOpen?: () => void }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <Tile
      label="Projects"
      accent={{ light: '#b45309', dark: 'rgba(252, 211, 77, 0.9)' }}
        deepLink="/#projects"
        onOpen={onOpen}
        modalLabel="Open Projects"
        className="min-h-[270px] sm:min-h-[235px] lg:min-h-0"
      >
        <div className="px-4 sm:px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-2 md:pt-[clamp(0.25rem,0.9dvh,0.75rem)] pb-3 md:pb-[clamp(0.5rem,1.4dvh,1.25rem)] flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col justify-evenly gap-2 lg:gap-[clamp(0.1rem,0.45dvh,0.4rem)]">
            {PROJECT_ITEMS.map((p) => (
              <Link
                key={p.name}
                href={p.url}
                target={p.external ? '_blank' : undefined}
                rel={p.external ? 'noopener noreferrer' : undefined}
                className="relative z-10 group min-h-0 flex items-center gap-2.5 md:gap-3 rounded-xl px-2.5 py-2 lg:px-[clamp(0.35rem,0.75dvh,0.55rem)] lg:py-[clamp(0.1rem,0.32dvh,0.3rem)] transition-all"
                style={{
                  background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.035)',
                  border: palette.hairline ? `1px solid ${palette.hairline}` : palette.cardBorder,
                }}
              >
                <div
                  className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 lg:h-[clamp(30px,3.55dvh,36px)] lg:w-[clamp(30px,3.55dvh,36px)]"
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
                  className="text-[13px] md:text-[clamp(11.5px,1.45dvh,14px)] font-semibold leading-tight tracking-tight truncate"
                  style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                >
                  {p.name}
                </div>
                  <div
                    className="line-clamp-2 text-[11px] md:text-[clamp(10px,1.25dvh,12px)] leading-tight tracking-tight"
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
            </Link>
          ))}
        </div>
          <a
          href="https://www.hatchingpoint.com/"
          target="_blank"
          rel="noopener noreferrer"
            className="relative z-10 mt-2 md:mt-[clamp(0.25rem,0.7dvh,0.5rem)] inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-[10px] md:text-[clamp(9.5px,1.15dvh,11px)] leading-none tracking-tight hover:opacity-100 opacity-80 transition-opacity"
            style={{
              color: palette.mutedText,
              background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.045)',
              border: palette.hairline ? `1px solid ${palette.hairline}` : palette.cardBorder,
            }}
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
