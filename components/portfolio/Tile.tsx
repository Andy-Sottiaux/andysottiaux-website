'use client'

import { ArrowUpRight, Maximize2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { haptic } from '@/lib/haptics'
import { useFieldTheme } from '../fieldTheme'

type TileAccent = {
  light: string
  dark: string
}

type TileProps = {
  children: ReactNode
  className?: string
  triggerClassName?: string
  accent?: TileAccent
  label?: string
  deepLink?: string
  onOpen?: () => void
  modalLabel?: string
}

export default function Tile({
  children,
  className = '',
  triggerClassName = '',
  accent,
  label,
  deepLink,
  onOpen,
  modalLabel,
}: TileProps) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const accentColor = accent
    ? isLight
      ? accent.light
      : accent.dark
    : undefined
  const modalAriaLabel = modalLabel ?? (label ? `Open ${label}` : 'Open')

  const openFromTileButton = () => {
    if (!onOpen) return
    haptic('open')
    onOpen()
  }

  return (
    <div
      data-peek-target="true"
      data-card-hover={onOpen || deepLink ? 'true' : undefined}
      className={`group relative z-[1] rounded-2xl overflow-hidden h-full flex flex-col ${className}`}
      style={{
        background: palette.cardBackground,
        border: palette.cardBorder,
        backdropFilter: 'var(--field-card-backdrop-filter, blur(8px))',
        WebkitBackdropFilter: 'var(--field-card-backdrop-filter, blur(8px))',
        boxShadow: palette.cardShadow,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: isLight
            ? 'linear-gradient(135deg, rgba(255,255,255,0.28), transparent 42%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.045), transparent 45%)',
        }}
      />
      {onOpen ? (
        <button
          type="button"
          aria-label={modalAriaLabel}
          aria-haspopup="dialog"
          data-modal-trigger={modalAriaLabel}
          title={modalAriaLabel}
          onClick={openFromTileButton}
          className={`absolute right-3 top-3 z-30 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${triggerClassName}`}
          style={{
            color: accentColor ?? palette.mutedText,
            background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.07)',
            border: palette.cardBorder,
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : deepLink ? (
        <a
          href={deepLink}
          aria-label={label ? `Open ${label} on the full site` : 'Open on the full site'}
          title={label ? `Open ${label} on the full site` : 'Open on the full site'}
          className="absolute right-3 top-3 z-30 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
          style={{
            color: accentColor ?? palette.mutedText,
            background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.07)',
            border: palette.cardBorder,
          }}
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : null}
      {label && (
        <div
          className="pointer-events-none relative z-10 px-5 pr-14 pt-4 text-[10px] font-semibold uppercase tracking-[0.22em] md:px-[clamp(1rem,1.7vw,1.5rem)] md:pr-14 md:pt-[clamp(0.75rem,1.55dvh,1.25rem)] md:text-[clamp(8.5px,1.1dvh,10px)]"
          style={{ color: accentColor ?? palette.mutedText }}
        >
          <span>{label}</span>
        </div>
      )}
      <div className="relative flex flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}
