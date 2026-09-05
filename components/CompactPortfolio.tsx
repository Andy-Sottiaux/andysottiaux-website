'use client'

/**
 * Personal, single-screen desktop dashboard with focused detail dialogs.
 * Health remains visible during faults; camera playback is always opt-in.
 * Public telemetry is shared across tiles and their expanded views.
 */

import { useState } from 'react'
import { FieldThemeProvider, useFieldTheme } from './fieldTheme'
import type { ModalKey } from './CompactModals'
import BentoGrid from './portfolio/BentoGrid'
import PortfolioModals from './portfolio/PortfolioModals'
import type { LiveSection } from './live/LiveSystemDashboard'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import type { HealthPollResult } from '@/lib/fieldHealth'

export default function CompactPortfolio({
  initialHealthPoll,
}: {
  /** Sanitized server-rendered reading, if available. */
  initialHealthPoll?: HealthPollResult
}) {
  return (
    <FieldThemeProvider>
      <CompactInner initialHealthPoll={initialHealthPoll} />
    </FieldThemeProvider>
  )
}

function CompactInner({
  initialHealthPoll,
}: {
  initialHealthPoll?: HealthPollResult
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  const [openModal, setOpenModal] = useState<ModalKey | null>(null)
  const [liveSection, setLiveSection] = useState<LiveSection>('overview')
  const [selectedCamera, setSelectedCamera] = useState<FieldCameraSource>('field')
  const [cameraSessionId, setCameraSessionId] = useState(0)
  const close = () => {
    setOpenModal(null)
    setCameraSessionId((current) => current + 1)
  }
  const open = (key: ModalKey, section: LiveSection = 'overview') => {
    setLiveSection(section)
    setOpenModal(key)
  }

  return (
    <main
      id="main-content"
      className="compact-portfolio relative w-full flex flex-col min-h-screen lg:h-[100dvh] lg:overflow-hidden"
      style={{
        background: palette.sectionBackground,
        color: isLight ? '#1c1a1c' : '#fff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {/* Site is dark-only — no theme toggle, no header. The bento IS the
          page.

          Desktop / laptop: bento fills the viewport exactly. `lg:h-[100dvh]`
          on <main> + `overflow-hidden` + a flex column that hands the
          remaining height down to the grid. Tile min-heights are zeroed on
          lg+, the grid uses `1fr` rows, so cards auto-size to fit without
          ever scrolling.
          Mobile: keeps `min-h-screen` and natural vertical scrolling. */}
      <div
        className="bento-shell flex-1 flex flex-col px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 lg:min-h-0"
        data-camera-performance="true"
      >
        <div className="w-full max-w-[1380px] mx-auto lg:flex-1 lg:flex lg:flex-col lg:min-h-0">
          <BentoGrid
            cameraEnabled={openModal === null}
            cameraSessionId={cameraSessionId}
            initialHealthPoll={initialHealthPoll}
            modalOpen={openModal !== null}
            onCameraChange={setSelectedCamera}
            onOpen={open}
          />
        </div>
      </div>

      <PortfolioModals
        initialHealthPoll={initialHealthPoll}
        openModal={openModal}
        initialSection={liveSection}
        selectedCamera={selectedCamera}
        onCameraChange={setSelectedCamera}
        onClose={close}
      />

    </main>
  )
}

/* Header removed — the bento itself is the page identity. */
