import type { Metadata } from 'next'
import ControlAuthProvider from '@/components/ControlAuthProvider'
import CompactPortfolio from '@/components/CompactPortfolio'
import { probeInitialHealth } from '@/lib/initialBoardHealth'

export const revalidate = 15

export const metadata: Metadata = {
  title: 'Andy Sottiaux — Dashboard Preview',
  description: 'A preview of Andy’s personal dashboard: engineering, projects, running, and connected systems.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/' },
}

export default async function DashboardPreview() {
  const initialHealthPoll = await probeInitialHealth()

  return (
    <ControlAuthProvider>
      <CompactPortfolio
        initialHealthPoll={initialHealthPoll}
      />
    </ControlAuthProvider>
  )
}
