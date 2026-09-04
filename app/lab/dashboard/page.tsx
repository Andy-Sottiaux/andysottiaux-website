import CompactPortfolio from '@/components/CompactPortfolio'
import type { Metadata } from 'next'
import { buildHealthDigest, healthLooksLive, type HealthLoose, type HealthPollResult } from '@/lib/fieldHealth'

// Bento home page. Replaces the long scrolling layout. The board's live
// state is probed server-side so the initial HTML already shows the
// correct (live or fallback) tile set — visitors arriving while the
// device is offline see the alternate set on first paint, no flicker.
export const revalidate = 15

export const metadata: Metadata = {
  title: 'Compact Engineering Dashboard',
  description: 'The compact view of Andy Sottiaux’s projects and connected field systems.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/lab/dashboard' },
}

const HEALTH_TIMEOUT_MS = 1200
const HEALTH_UPSTREAM = (
  process.env.V3_HEALTH_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'
).replace(/\/+$/, '')

async function probeInitialHealth(): Promise<HealthPollResult> {
  const startedAt = Date.now()
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)

  try {
    const r = await fetch(`${HEALTH_UPSTREAM}/api/health`, {
      next: { revalidate },
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/initial-health' },
    })
    if (!r.ok) return { digest: null }

    const body = (await r.json()) as HealthLoose
    if (!healthLooksLive(body)) return { digest: null }

    const fetchedAt = Date.now()
    return {
      digest: buildHealthDigest(body, fetchedAt - startedAt, fetchedAt),
    }
  } catch {
    return { digest: null }
  } finally {
    clearTimeout(timeout)
  }
}

export default async function Home() {
  const initialHealthPoll = await probeInitialHealth()
  const initialBoardLive = initialHealthPoll.digest?.ok === true

  return <CompactPortfolio initialBoardLive={initialBoardLive} initialHealthPoll={initialHealthPoll} />
}
