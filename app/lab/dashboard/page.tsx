import CompactPortfolio from '@/components/CompactPortfolio'
import type { Metadata } from 'next'
import { probeInitialHealth } from '@/lib/initialBoardHealth'

// Retained compact-dashboard URL. Server-rendered telemetry is sanitized;
// the health tile stays visible when a device is offline.
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
