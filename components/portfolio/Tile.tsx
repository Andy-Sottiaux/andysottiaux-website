'use client'

import type { MouseEvent, ReactNode } from 'react'
import { haptic } from '@/lib/haptics'
import { useFieldTheme } from '../fieldTheme'

type TileAccent = {
  light: string
  dark: string
}

type TileProps = {
  children: ReactNode
  className?: string
  accent?: TileAccent
  label?: string
  deepLink?: string
  onOpen?: () => void
  modalLabel?: string
}

export default function Tile({
  children,
  className = '',
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

  const openFromTileChrome = (event: MouseEvent<HTMLDivElement>) => {
    if (!onOpen) return
    const target = event.target as HTMLElement | null
    const nestedInteractive = target?.closest('a, button, input, select, textarea')
    if (nestedInteractive) return
    haptic('open')
    onOpen()
  }

  const openFromTileButton = () => {
    if (!onOpen) return
    haptic('open')
    onOpen()
  }

  return (
    <div
      data-peek-target="true"
      data-card-hover={onOpen || deepLink ? 'true' : undefined}
      data-modal-trigger={onOpen ? modalAriaLabel : undefined}
      onClick={onOpen ? openFromTileChrome : undefined}
      className={`group relative z-[1] rounded-2xl overflow-hidden h-full flex flex-col ${onOpen || deepLink ? 'cursor-pointer' : ''} ${className}`}
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
          onClick={openFromTileButton}
          className="absolute inset-0 z-[2] cursor-pointer"
        />
      ) : deepLink ? (
        <a
          href={deepLink}
          aria-label={label ? `Open ${label} on the full site` : 'Open on the full site'}
          className="absolute inset-0 z-0"
        />
      ) : null}
      {label && (
        <div
          className="relative z-10 px-5 md:px-[clamp(1rem,1.7vw,1.5rem)] pt-4 md:pt-[clamp(0.75rem,1.55dvh,1.25rem)] text-[10px] md:text-[clamp(8.5px,1.1dvh,10px)] font-semibold uppercase tracking-[0.22em] flex items-center justify-between pointer-events-none"
          style={{ color: accentColor ?? palette.mutedText }}
        >
          <span>{label}</span>
          {(deepLink || onOpen) && (
            <svg
              className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {onOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M7 17L17 7M9 7h8v8" />
              )}
            </svg>
          )}
        </div>
      )}
      <div className="relative z-10 flex flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}
