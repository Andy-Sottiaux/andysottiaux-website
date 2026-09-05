'use client'

/**
 * Modal — accessible, theme-aware dialog used by the compact bento.
 *
 * Behaviour:
 *  - Backdrop click + Escape both close
 *  - Focus is moved into the modal on open and restored to the
 *    `originElement` (or last-focused element) on close
 *  - A simple Tab loop keeps focus inside while open
 *  - Renders into `document.body` via createPortal so z-index conflicts
 *    with the bento grid don't matter
 *  - Animation is opt-in via prefers-reduced-motion
 *
 * Visual chrome (rounded-3xl glass panel, soft border, large shadow) matches
 * the bento tile language so the modal feels like an "expanded tile" rather
 * than a generic overlay.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFieldTheme } from './fieldTheme'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { haptic } from '@/lib/haptics'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  /** Optional eyebrow text shown above the title in muted accent. */
  eyebrow?: string
  children: React.ReactNode
  /** Used to size the modal — defaults to 'md' (~720px). */
  size?: 'md' | 'lg'
}

export default function Modal({ open, onClose, title, eyebrow, children, size = 'md' }: Props) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const reducedMotion = useReducedMotion()

  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const originRef = useRef<HTMLElement | null>(null)

  // Capture the element that had focus when the modal opened, so we can
  // restore it on close. React's `aria-haspopup` plus this restore are the
  // two things screen-reader users notice most.
  useEffect(() => {
    if (!open) return
    originRef.current = (document.activeElement as HTMLElement) ?? null
    // Move focus to the close button after the panel mounts.
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])

  // Restore focus on close
  useEffect(() => {
    if (open) return
    const origin = originRef.current
    if (origin && typeof origin.focus === 'function') {
      // microtask so the modal has finished unmounting first
      window.setTimeout(() => origin.focus(), 0)
    }
  }, [open])

  // Lock body scroll while open. Avoids the page underneath drifting if
  // the user wheel-scrolls inside an overflow-y-auto modal.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const maxWidth = size === 'lg' ? 880 : 720
  const animDuration = reducedMotion ? '0ms' : '300ms'
  const backdropDuration = reducedMotion ? '0ms' : '200ms'

  return createPortal(
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[1000] m-0 h-screen max-h-none w-screen max-w-none border-0 bg-transparent p-0 overflow-visible"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]',
        )).filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="fixed inset-0 flex items-center justify-center">
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close dialog"
          tabIndex={-1}
          onClick={onClose}
          className="absolute inset-0 cursor-default"
          style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: reducedMotion ? 'none' : `fldModalFade ${backdropDuration} ease forwards`,
          }}
        />

        {/* Panel */}
        <div
          className="relative w-full max-h-[min(86vh,760px)] mx-4 sm:mx-6 rounded-3xl overflow-hidden flex flex-col [backdrop-filter:blur(8px)] [-webkit-backdrop-filter:blur(8px)]"
          style={{
            maxWidth,
            background: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(12,12,15,0.94)',
            border: palette.cardBorder,
            boxShadow: isLight
              ? '0 40px 100px rgba(28,26,28,0.22), 0 8px 24px rgba(28,26,28,0.08)'
              : '0 40px 100px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)',
            color: isLight ? '#1c1a1c' : '#fff',
            animation: reducedMotion ? 'none' : `fldModalIn ${animDuration} cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            opacity: reducedMotion ? 1 : 0,
          }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 sm:pt-7 pb-4"
            style={{ borderBottom: palette.cardBorder }}
          >
            <div className="min-w-0">
              {eyebrow && (
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.22em] mb-1.5"
                  style={{ color: palette.mutedText }}
                >
                  {eyebrow}
                </div>
              )}
              <h2
                className="text-[20px] sm:text-[24px] font-semibold tracking-tight leading-tight"
                style={{
                  backgroundImage: palette.headlineGradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {title}
              </h2>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => { haptic('tap'); onClose() }}
              aria-label="Close"
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
                color: isLight ? '#1c1a1c' : '#fff',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body — scrolls if content exceeds viewport */}
          <div tabIndex={0} className="px-6 sm:px-8 py-5 sm:py-6 overflow-y-auto flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/70">
            {children}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fldModalFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fldModalIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </dialog>,
    document.body,
  )
}
