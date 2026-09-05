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
        <div className="px-4 sm:px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-2 pb-3 lg:py-1 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col justify-evenly gap-2 lg:gap-0.5">
            {PROJECT_ITEMS.map((p) => (
              <Link
                key={p.name}
                href={p.url}
                target={p.external ? '_blank' : undefined}
                rel={p.external ? 'noopener noreferrer' : undefined}
                className="relative z-10 group min-h-0 flex items-center gap-2.5 md:gap-3 rounded-xl px-2.5 py-2 lg:px-2 lg:py-px transition-all"
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
                  className="text-sm font-semibold leading-tight tracking-tight truncate"
                  style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                >
                  {p.name}
                </div>
                  <div
                    className="line-clamp-2 text-xs leading-tight tracking-tight lg:line-clamp-1"
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
      </div>
    </Tile>
  )
}
