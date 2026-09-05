'use client'

import Link from 'next/link'
import FieldSolarCard from '../FieldSolarCard'
import { haptic } from '@/lib/haptics'

/* ───────────────────── Solar tile ──────────────────────── */

export default function SolarTile({ onOpen }: { onOpen?: () => void }) {
  // FieldSolarCard already brings its own chrome. Wrap in a button or anchor
  // so the click on the card body opens the live modal (or, when modals are
  // disabled, deep-links to the home-page section).
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={() => { haptic('open'); onOpen() }}
        aria-haspopup="dialog"
        aria-label="Open power details"
        data-card-hover="true"
        className="block w-full h-full min-h-[520px] sm:min-h-[430px] lg:min-h-0 [&>div]:h-full text-left"
      >
        <FieldSolarCard variant="compact" />
      </button>
    )
  }
  return (
    <Link
      href="/#now"
      aria-label="Open Field Live on the full site"
      data-card-hover="true"
      className="block h-full min-h-[520px] sm:min-h-[430px] lg:min-h-0 [&>div]:h-full"
    >
      <FieldSolarCard variant="compact" />
    </Link>
  )
}
