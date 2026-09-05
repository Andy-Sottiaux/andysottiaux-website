'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useId, useState } from 'react'
import CameraIdleSurface from '../CameraIdleSurface'
import CameraIntelligencePanel from '../CameraIntelligencePanel'
import CameraSourceToggle from '../CameraSourceToggle'
import { useControlAuth } from '../ControlAuthProvider'
import FieldHealthCard from '../FieldHealthCard'
import FieldSolarCard from '../FieldSolarCard'
import { useFieldTheme } from '../fieldTheme'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import type { HealthPollResult } from '@/lib/fieldHealth'

const CameraFeedSwitcher = dynamic(() => import('../CameraFeedSwitcher'), { ssr: false, loading: () => <CameraIdleSurface mode="loading" /> })
export type LiveSection = 'overview' | 'camera' | 'power' | 'diagnostics'
const SECTIONS: LiveSection[] = ['overview', 'camera', 'power', 'diagnostics']

export default function LiveSystemDashboard({ initialHealthPoll, initialSection = 'overview', selectedCamera = 'field', onCameraChange = () => undefined, showCaseStudyLink = true }: {
  initialHealthPoll?: HealthPollResult; initialSection?: LiveSection; selectedCamera?: FieldCameraSource
  onCameraChange?: (value: FieldCameraSource) => void; showCaseStudyLink?: boolean
}) {
  const palette = useFieldTheme()
  const { unlocked, lockAccess, requestUnlock } = useControlAuth()
  const [section, setSection] = useState<LiveSection>(initialSection)
  const [playing, setPlaying] = useState(false)
  const [locking, setLocking] = useState(false)
  const [lockError, setLockError] = useState(false)
  const id = useId()
  const surface = { border: palette.cardBorder, background: palette.cardBackground, color: palette.bodyText }
  const lock = async () => {
    setPlaying(false)
    setLocking(true)
    setLockError(false)
    try { setLockError(!(await lockAccess())) }
    catch { setLockError(true) }
    finally { setLocking(false) }
  }
  const select = (next: LiveSection) => { setPlaying(false); setSection(next) }

  return <div className="flex flex-col gap-4" data-camera-performance="true">
    <div role="tablist" aria-label="Live system sections" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SECTIONS.map((name, index) => <button key={name} type="button" role="tab" id={`${id}-${name}-tab`} aria-controls={`${id}-${name}-panel`} aria-selected={section === name} tabIndex={section === name ? 0 : -1}
        className="min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-cyan-300"
        style={{ ...surface, color: section === name ? '#67e8f9' : palette.bodyText, borderColor: section === name ? 'rgba(103,232,249,.55)' : 'rgba(255,255,255,.14)' }}
        onClick={() => select(name)} onKeyDown={(event) => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : null
          if (next !== null) { event.preventDefault(); document.getElementById(`${id}-${SECTIONS[next]}-tab`)?.focus() }
        }}>{name}</button>)}
    </div>
    {SECTIONS.map((name) => <section key={name} role="tabpanel" id={`${id}-${name}-panel`} aria-labelledby={`${id}-${name}-tab`} hidden={section !== name}>
      {section === name && name === 'overview' && <div className="space-y-5 rounded-2xl p-5 sm:p-6" style={surface}>
        <div><h3 className="text-xl font-semibold text-white">Inside the field system</h3><p className="mt-2 text-base leading-relaxed">An off-grid camera system I built across hardware, embedded Linux, on-device inference, and the web.</p></div>
        <ol aria-label="System flow" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Solar', 'Victron telemetry'], ['Battery', 'LiFePO4 buffer'], ['Camera', 'On-device inference'], ['Relay', 'Protected web access']].map(([label, detail], index) => <li key={label} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><span className="text-xs text-cyan-200">0{index + 1}</span><div className="mt-2 text-base font-semibold text-white">{label}</div><div className="mt-1 text-sm">{detail}</div></li>)}</ol>
        <p className="text-sm leading-relaxed">The board runs inference locally. A separate relay handles browser delivery, keeping device credentials and controls private. Public readings stay visible; camera playback is opt-in and access-controlled.</p>
        {showCaseStudyLink && <Link href="/work/field-camera" className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 underline underline-offset-4">Field-camera case study ↗</Link>}
      </div>}
      {section === name && name === 'camera' && <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><CameraSourceToggle value={selectedCamera} onChange={(value) => { setPlaying(false); onCameraChange(value) }} isLight={palette.mode === 'light'} />{playing && <button type="button" onClick={() => setPlaying(false)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm">Pause playback</button>}</div>
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black"><CameraFeedSwitcher selectedCamera={selectedCamera} enabled={playing} onStart={() => setPlaying(true)} /></div>
        <p className="text-sm leading-relaxed" style={{ color: palette.bodyText }}>Playback starts only when you press Play or unlock this stream. Delivered video rate and transport statistics appear during playback; configured camera FPS is not a measurement of delivery or inference.</p>
      </div>}
      {section === name && name === 'power' && <FieldSolarCard />}
      {section === name && name === 'diagnostics' && <div className="space-y-4"><p className="text-sm" style={{ color: palette.bodyText }}>Field-board / Cam 1 diagnostics. These readings do not describe Cam 2. Source age is separate from request time.</p><FieldHealthCard initialHealthPoll={initialHealthPoll} /><CameraIntelligencePanel enabled={unlocked} /></div>}
    </section>)}
    {unlocked && <div className="flex items-center gap-3"><button type="button" aria-label="Lock camera access" disabled={locking} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm disabled:opacity-50" onClick={() => void lock()}>{locking ? 'Locking…' : 'Lock access'}</button>{lockError && <span role="alert" className="text-sm text-amber-300">Lock failed. Try again.</span>}</div>}
    {!unlocked && <button type="button" onClick={() => void requestUnlock()} className="min-h-11 self-start rounded-xl border border-white/15 px-4 text-sm">Unlock access</button>}
  </div>
}
