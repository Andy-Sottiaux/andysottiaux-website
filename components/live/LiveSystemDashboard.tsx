'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowUpRight, LockKeyhole } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import CameraIdleSurface from '../CameraIdleSurface'
import CameraIntelligencePanel from '../CameraIntelligencePanel'
import CameraSourceToggle from '../CameraSourceToggle'
import { useControlAuth } from '../ControlAuthProvider'
import FieldHealthCard from '../FieldHealthCard'
import FieldSolarCard from '../FieldSolarCard'
import { useFieldTheme } from '../fieldTheme'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import type { HealthPollResult } from '@/lib/fieldHealth'

const CameraFeedSwitcher = dynamic(() => import('../CameraFeedSwitcher'), {
  ssr: false,
  loading: () => <CameraIdleSurface mode="loading" />,
})

const LIVE_PROOF = [
  { label: 'Edge stack', value: 'Linux board, 5 MP camera, on-device inference, thermal/fan health' },
  { label: 'Power stack', value: 'Solar + LiFePO4 telemetry with graceful stale/offline behavior' },
  { label: 'Web stack', value: 'Same-origin Next.js APIs, signed access session, protected stream fallback' },
]

const LIVE_ROLES = ['Hardware integration', 'Embedded services', 'Camera relay', 'Telemetry UI', 'Failure states']

export default function LiveSystemDashboard({
  initialHealthPoll,
  selectedCamera = 'field',
  onCameraChange = () => undefined,
  showCaseStudyLink = true,
}: {
  initialHealthPoll?: HealthPollResult
  selectedCamera?: FieldCameraSource
  onCameraChange?: (value: FieldCameraSource) => void
  showCaseStudyLink?: boolean
}) {
  const palette = useFieldTheme()
  const { unlocked, lockAccess } = useControlAuth()
  const [locking, setLocking] = useState(false)
  const [lockError, setLockError] = useState(false)
  const isLight = palette.mode === 'light'
  const intro = selectedCamera === 'field'
    ? 'Live edge-AI camera and solar telemetry from a board I built end-to-end: hardware integration, Linux services, protected relay APIs, and authenticated playback.'
    : 'HatchingPoint-branded Thingino E220 view through the protected relay. Camera, control, and device credentials stay off the browser.'

  return (
    <div className="flex flex-col gap-5" data-camera-performance="true">
      <div
        className="rounded-[8px] p-4 sm:p-5"
        style={polishedSurfaceStyle(
          isLight,
          palette.cardBorder,
          isLight ? 'rgba(10,138,168,0.055)' : 'rgba(103,232,249,0.075)'
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] font-semibold uppercase" style={{ color: palette.mutedText }}>
              Live system
            </div>
            <div
              className="mt-1.5 text-[16px] font-semibold leading-tight sm:text-[18px]"
              style={{ color: isLight ? '#1c1a1c' : '#fff' }}
            >
              Camera relay, telemetry, and edge-AI health in one surface.
            </div>
            <p className="mt-2 text-[13px] leading-snug sm:text-[13.5px]" style={{ color: palette.bodyText }}>
              {intro}
            </p>
          </div>
          <div className="shrink-0">
            <CameraSourceToggle value={selectedCamera} onChange={onCameraChange} isLight={isLight} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {LIVE_ROLES.map((role) => <Chip key={role}>{role}</Chip>)}
          {showCaseStudyLink && (
            <Link
              href="/work/field-camera"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[10.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              style={{
                background: isLight ? 'rgba(10,138,168,0.09)' : 'rgba(103,232,249,0.1)',
                color: isLight ? '#08748e' : 'rgb(103,232,249)',
              }}
            >
              Field-camera case study
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
          {unlocked && (
            <button
              type="button"
              disabled={locking}
              onClick={() => {
                setLocking(true)
                setLockError(false)
                void lockAccess().then((locked) => {
                  setLockError(!locked)
                  setLocking(false)
                })
              }}
              aria-label="Lock camera access"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[10.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300/70 disabled:opacity-50"
              style={{
                background: isLight ? 'rgba(28,26,28,0.06)' : 'rgba(255,255,255,0.08)',
                color: palette.mutedText,
              }}
            >
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              {locking ? 'Locking' : 'Lock access'}
            </button>
          )}
          {lockError && (
            <span role="alert" className="text-[10.5px] font-semibold text-amber-400">
              Lock failed. Try again.
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {LIVE_PROOF.map((item) => (
          <div key={item.label} className="rounded-[8px] p-3.5" style={polishedSurfaceStyle(isLight, palette.cardBorder)}>
            <div className="text-[9.5px] font-semibold uppercase" style={{ color: palette.mutedText }}>
              {item.label}
            </div>
            <div className="mt-1 text-[12px] leading-snug" style={{ color: palette.bodyText }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {selectedCamera === 'field' && <CameraIntelligencePanel enabled={unlocked} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <div
            className="relative w-full overflow-hidden rounded-[8px]"
            style={{
              aspectRatio: '16 / 9',
              background: isLight ? '#0a0a0c' : '#000',
              boxShadow: isLight ? '0 4px 12px rgba(28,26,28,0.12)' : '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <CameraFeedSwitcher selectedCamera={selectedCamera} enabled />
          </div>
        </div>
        <div className="md:col-span-1 [&>div]:h-full">
          <FieldHealthCard initialHealthPoll={initialHealthPoll} />
        </div>
        <div className="md:col-span-3 [&>div]:h-full">
          <FieldSolarCard />
        </div>
      </div>

      <ul
        className="grid grid-cols-1 gap-2 pt-1 text-[12px] leading-snug sm:grid-cols-2"
        style={{ color: palette.mutedText }}
      >
        {[
          '5 MP H.265 sensor, browser-safe preview path',
          'Linux board with on-device inference',
          'Solar + LiFePO4 buffer, off-grid capable',
          'Password-protected stream surface',
        ].map((item) => (
          <li
            key={item}
            className="rounded-[8px] px-2.5 py-2"
            style={{
              background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.035)',
              border: palette.hairline ? `1px solid ${palette.hairline}` : palette.cardBorder,
            }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function polishedSurfaceStyle(isLight: boolean, border: string, accentGlow?: string): CSSProperties {
  return {
    background: accentGlow
      ? isLight
        ? `linear-gradient(135deg, ${accentGlow}, rgba(0,0,0,0.012))`
        : `linear-gradient(135deg, ${accentGlow}, rgba(255,255,255,0.032))`
      : isLight
        ? 'rgba(0,0,0,0.025)'
        : 'rgba(255,255,255,0.03)',
    border,
  }
}

function Chip({ children }: { children: ReactNode }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <span
      className="rounded-[6px] px-2 py-1 text-[10.5px] font-medium sm:text-[11px]"
      style={{
        background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
        color: palette.bodyText,
      }}
    >
      {children}
    </span>
  )
}
