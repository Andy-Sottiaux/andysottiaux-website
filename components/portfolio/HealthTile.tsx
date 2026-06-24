'use client'

import Link from 'next/link'
import FieldHealthCard from '../FieldHealthCard'
import type { HealthPollResult } from '@/lib/fieldHealth'

/* ───────────────────── Health tile ──────────────────────── */

export default function HealthTile({
  initialHealthPoll,
  onOpen,
}: {
  initialHealthPoll?: HealthPollResult
  onOpen?: () => void
}) {
  if (onOpen) {
    return (
      <div
        data-card-hover="true"
        className="block w-full h-full min-h-[260px] lg:min-h-0 [&>div]:h-full text-left"
      >
        <FieldHealthCard initialHealthPoll={initialHealthPoll} variant="compact" />
      </div>
    )
  }
  return (
    <Link
      href="/#now"
      aria-label="Open Field Live on the full site"
      data-card-hover="true"
      className="block h-full min-h-[260px] lg:min-h-0 [&>div]:h-full"
    >
      <FieldHealthCard initialHealthPoll={initialHealthPoll} variant="compact" />
    </Link>
  )
}
