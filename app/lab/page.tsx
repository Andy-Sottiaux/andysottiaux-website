import type { Metadata } from 'next'
import LiveLabPage from '@/components/live/LiveLabPage'

export const metadata: Metadata = {
  title: 'Live Engineering Lab',
  description: 'Live edge-camera, embedded AI, system health, and solar telemetry from Andy Sottiaux\'s field systems.',
  alternates: { canonical: '/lab' },
}

export default function LabPage() {
  return <LiveLabPage />
}
