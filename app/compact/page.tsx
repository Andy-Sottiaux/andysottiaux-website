import type { Metadata } from 'next'
import { headers } from 'next/headers'
import CompactPortfolio from '@/components/CompactPortfolio'

// Single-viewport, bento-style alternative to the home page. Lives at
// /compact while the user evaluates it side-by-side with `/`. Home page
// (`/`) is intentionally untouched.
export const metadata: Metadata = {
  title: 'Andy Sottiaux - Compact',
  description:
    'Single-viewport portfolio for Andy Sottiaux. Aerospace hardware and production software, with a live edge-AI field deployment.',
  alternates: {
    canonical: 'https://andysottiaux.com/compact',
  },
  // Keep /compact out of search indexes while it's an evaluation surface.
  // Flip to indexable if/when this becomes the canonical home.
  robots: {
    index: false,
    follow: true,
  },
}

// Re-render the SSR shell at most every 15 s. The client still polls every
// 8 s on top of this, but the SERVER's snapshot of "is the board online" is
// what decides which tiles ship in the initial HTML — so a returning
// visitor gets the right shape on first paint, no live→fallback flicker.
export const revalidate = 15

const HEALTH_TIMEOUT_MS = 3000

/** Server-side probe of the same /api/v3/health endpoint the client polls.
 *  Returns true on a clean 2xx with `ok !== false`; returns false on any
 *  network error, timeout, non-2xx, or `{ok: false}` body. Bounded so a
 *  slow upstream never blocks page render past 3 s. */
async function probeBoardLive(origin: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)
    const r = await fetch(`${origin}/api/v3/health`, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!r.ok) return false
    const body = (await r.json()) as { ok?: boolean; error?: string }
    return body?.ok !== false && !body?.error
  } catch {
    return false
  }
}

export default async function CompactPage() {
  // Resolve our own origin from the request headers so we can hit the
  // sibling /api/v3/health route during SSR. Falls back to a sane default
  // for local dev where the headers might be missing.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'andysottiaux.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`

  const initialBoardLive = await probeBoardLive(origin)

  return <CompactPortfolio initialBoardLive={initialBoardLive} />
}
