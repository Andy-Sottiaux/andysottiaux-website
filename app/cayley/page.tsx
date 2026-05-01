import type { Metadata } from 'next'
import CayleyPlatform from '@/components/CayleyPlatform'

export const metadata: Metadata = {
  title: 'Cayley V3 — Development Platform',
  description:
    'Live development platform for the Cayley V3 solar-powered AI camera. Interactive 3D board, real-time telemetry, boot-sequence walkthrough, and recovery-layer architecture.',
}

export default function Page() {
  return <CayleyPlatform />
}
