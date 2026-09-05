import CompactPortfolio from '@/components/CompactPortfolio'
import type { Metadata } from 'next'
import { probeInitialHealth } from '@/lib/initialBoardHealth'

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

export default async function Home() {
  const initialHealthPoll = await probeInitialHealth()

  return <CompactPortfolio initialHealthPoll={initialHealthPoll} />
}
