'use client'

/**
 * CompactPortfolio — single-viewport bento home page.
 *
 * Two upgrades layered on top of the original bento:
 *
 *   1. Smart fallback tiles. The board (`/api/v3/health`) is polled by a
 *      single shared `useBoardLive()` hook with hysteresis (see lib).
 *      Camera stays visible even when health is unreachable, so visitors see
 *      the stream's own offline state instead of the feed disappearing. Solar
 *      is independent now because it comes from the Raspberry Pi/Victron path;
 *      only health swaps to fallback content when the camera board is stale.
 *
 *   2. Modal expansion. Clicking a tile body opens an in-place modal with
 *      an expanded view of that section instead of navigating off to
 *      `/#section`. The deep-link `<a>` is still rendered as a fallback,
 *      but `onOpen` takes precedence when provided.
 *
 * Layout (1440×900 desktop, viewport-filling bento):
 *   ┌────────────┬─────────────────────────┬────────────┐
 *   │ identity   │ camera                  │ solar      │
 *   ├────────────┤                         │            │
 *   │ health     │                         │            │
 *   ├────────────┴──────────────┬──────────┴────────────┤
 *   │ experience                │ marathon │ contact    │
 *   ├───────────────────────────┤          │            │
 *   │ projects                  │          │            │
 *   └───────────────────────────┴──────────┴────────────┘
 *
 * Mobile: stacks vertically. Modal renders full-bleed-ish.
 */

import { useState } from 'react'
import { FieldThemeProvider, useFieldTheme } from './fieldTheme'
import type { ModalKey } from './CompactModals'
import BentoGrid from './portfolio/BentoGrid'
import PortfolioModals from './portfolio/PortfolioModals'
import { useBoardLive } from '@/lib/useBoardLive'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import type { HealthPollResult } from '@/lib/fieldHealth'

export default function CompactPortfolio({
  initialBoardLive = true,
  initialHealthPoll,
}: {
  /** SSR-resolved board liveness, passed in from app/compact/page.tsx
   *  so the initial HTML already shows the correct (live or fallback)
   *  tiles — no fallback-then-live flicker for visitors arriving while
   *  the board is down. */
  initialBoardLive?: boolean
  initialHealthPoll?: HealthPollResult
}) {
  return (
    <FieldThemeProvider>
      <CompactInner initialBoardLive={initialBoardLive} initialHealthPoll={initialHealthPoll} />
    </FieldThemeProvider>
  )
}

function CompactInner({
  initialBoardLive,
  initialHealthPoll,
}: {
  initialBoardLive: boolean
  initialHealthPoll?: HealthPollResult
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const boardLive = useBoardLive(initialBoardLive)

  const [openModal, setOpenModal] = useState<ModalKey | null>(null)
  const [selectedCamera, setSelectedCamera] = useState<FieldCameraSource>('field')
  const [cameraSessionId, setCameraSessionId] = useState(0)
  const close = () => {
    setOpenModal(null)
    setCameraSessionId((current) => current + 1)
  }
  const open = (key: ModalKey) => setOpenModal(key)

  return (
    <main
      id="main-content"
      className="relative w-full flex flex-col min-h-screen lg:h-[100dvh] lg:overflow-hidden"
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
            boardLive={boardLive}
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
        selectedCamera={selectedCamera}
        onCameraChange={setSelectedCamera}
        onClose={close}
      />

    </main>
  )
}

/* Header removed — the bento itself is the page identity. */
