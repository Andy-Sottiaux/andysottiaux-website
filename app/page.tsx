import { headers } from 'next/headers'
import CompactPortfolio from '@/components/CompactPortfolio'
import { buildHealthDigest, healthLooksLive, type HealthLoose, type HealthPollResult } from '@/lib/fieldHealth'

// Bento home page. Replaces the long scrolling layout. The board's live
// state is probed server-side so the initial HTML already shows the
// correct (live or fallback) tile set — visitors arriving while the
// device is offline see the alternate set on first paint, no flicker.
export const revalidate = 15

const HEALTH_TIMEOUT_MS = 3000

async function probeInitialHealth(origin: string): Promise<HealthPollResult> {
  const startedAt = Date.now()

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)
    const r = await fetch(`${origin}/api/v3/health`, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!r.ok) return { digest: null }

    const body = (await r.json()) as HealthLoose
    if (!healthLooksLive(body)) return { digest: null }

    const fetchedAt = Date.now()
    return {
      digest: buildHealthDigest(body, fetchedAt - startedAt, fetchedAt),
    }
  } catch {
    return { digest: null }
  }
}

export default async function Home() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'andysottiaux.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`

  const initialHealthPoll = await probeInitialHealth(origin)
  const initialBoardLive = initialHealthPoll.digest?.ok === true

  return <CompactPortfolio initialBoardLive={initialBoardLive} initialHealthPoll={initialHealthPoll} />
}
