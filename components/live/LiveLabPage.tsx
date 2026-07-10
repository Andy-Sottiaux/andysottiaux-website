'use client'

import Link from 'next/link'
import { ArrowLeft, Code2, Mail } from 'lucide-react'
import { useState } from 'react'
import LiveSystemDashboard from './LiveSystemDashboard'
import { FieldThemeProvider, useFieldTheme } from '../fieldTheme'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'

export default function LiveLabPage() {
  return (
    <FieldThemeProvider>
      <LiveLabInner />
    </FieldThemeProvider>
  )
}

function LiveLabInner() {
  const palette = useFieldTheme()
  const [selectedCamera, setSelectedCamera] = useState<FieldCameraSource>('field')

  return (
    <main
      id="main-content"
      className="min-h-screen"
      data-camera-performance="true"
      style={{ background: palette.sectionBackground, color: '#fff' }}
    >
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/"
              aria-label="Back to portfolio"
              title="Back to portfolio"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] text-white/75 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-cyan-300">Live lab</div>
              <h1 className="truncate text-lg font-semibold sm:text-xl">Field systems and operational telemetry</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Andy-Sottiaux"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="GitHub"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] text-white/70 hover:text-white"
            >
              <Code2 className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="mailto:andrewsottiaux@gmail.com"
              aria-label="Email Andy"
              title="Email Andy"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.04] text-white/70 hover:text-white"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1380px] px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <LiveSystemDashboard
          selectedCamera={selectedCamera}
          onCameraChange={setSelectedCamera}
          showCaseStudyLink
        />
      </div>
    </main>
  )
}
