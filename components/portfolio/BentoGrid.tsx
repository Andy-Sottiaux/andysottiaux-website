'use client'

import type { ReactNode } from 'react'
import type { ModalKey } from '../CompactModals'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import type { HealthPollResult } from '@/lib/fieldHealth'
import ContactTile from './ContactTile'
import EducationTile from './EducationTile'
import ExperienceTile from './ExperienceTile'
import HealthTile from './HealthTile'
import IdentityTile from './IdentityTile'
import MarathonTile from './MarathonTile'
import ProjectsTile from './ProjectsTile'
import SolarTile from './SolarTile'
import SpotlightTile from './SpotlightTile'

/* ─────────────────────────── Bento ──────────────────────────── */

export default function BentoGrid({
  boardLive,
  cameraEnabled,
  cameraSessionId,
  initialHealthPoll,
  modalOpen,
  onCameraChange,
  onOpen,
}: {
  boardLive: boolean
  cameraEnabled: boolean
  cameraSessionId: number
  initialHealthPoll?: HealthPollResult
  modalOpen: boolean
  onCameraChange: (value: FieldCameraSource) => void
  onOpen: (key: ModalKey) => void
}) {
  return (
    <div
      className="portfolio-grid grid gap-3 md:gap-4 mt-4 lg:mt-0 lg:flex-1 lg:min-h-0 [grid-auto-rows:auto] lg:grid-rows-4 lg:[grid-auto-rows:minmax(0,1fr)]"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      }}
    >
      {/* Spotlight spans two rows and keeps live camera streams paused until
          the visitor explicitly presses play. */}
      <div id="about" className="order-1 col-span-12 lg:order-none lg:col-span-3 lg:col-start-1 lg:row-start-1">
        <IdentityTile onOpen={() => onOpen('about')} />
      </div>

      <div id="now" className="order-2 col-span-12 lg:order-none lg:col-span-6 lg:col-start-4 lg:row-start-1 lg:row-span-2">
        <SpotlightTile
          enabled={cameraEnabled}
          streamSessionId={cameraSessionId}
          modalOpen={modalOpen}
          onCameraChange={onCameraChange}
          onOpen={onOpen}
        />
      </div>

      <div className="order-7 col-span-12 lg:order-none lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:row-span-2">
        <SolarTile onOpen={() => onOpen('live')} />
      </div>

      <div className="order-6 col-span-12 lg:order-none lg:col-span-3 lg:col-start-1 lg:row-start-2">
        <StableSwapTile
          showLive={boardLive}
          live={<HealthTile initialHealthPoll={initialHealthPoll} onOpen={() => onOpen('live')} />}
          fallback={<EducationTile />}
        />
      </div>

      <div id="experience" className="order-5 col-span-12 lg:order-none lg:col-span-5 lg:col-start-1 lg:row-start-3">
        <ExperienceTile onOpen={() => onOpen('experience')} />
      </div>
      <div id="projects" className="order-4 col-span-12 lg:order-none lg:col-span-5 lg:col-start-1 lg:row-start-4">
        <ProjectsTile onOpen={() => onOpen('projects')} />
      </div>
      <div className="order-8 col-span-12 lg:order-none lg:col-span-4 lg:col-start-6 lg:row-start-3 lg:row-span-2">
        <MarathonTile onOpen={() => onOpen('marathon')} />
      </div>
      <div id="contact" className="order-3 col-span-12 lg:order-none lg:col-span-3 lg:col-start-10 lg:row-start-3 lg:row-span-2">
        <ContactTile onOpen={() => onOpen('contact')} />
      </div>
    </div>
  )
}

/* ─────────────────── Stable live/fallback wrapper ──────────────────────── */

function StableSwapTile({
  showLive,
  live,
  fallback,
}: {
  showLive: boolean
  live: ReactNode
  fallback: ReactNode
}) {
  return <>{showLive ? live : fallback}</>
}
