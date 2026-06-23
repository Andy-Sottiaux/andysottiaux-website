'use client'

/**
 * CompactModals — content panels rendered inside the bento <Modal>.
 *
 * Each panel is the "expanded view" of one tile. Where reasonable we reuse
 * data from the home-page section components (Experience.tsx, Projects.tsx)
 * without re-rendering those components themselves — they own their full-
 * page chrome (section padding, SectionHeader) which would look wrong
 * stacked inside a modal. The data structures are duplicated here, the
 * presentation is modal-appropriate.
 *
 * One file with all six panels keeps the import surface tiny and the
 * tiles' state plumbing readable from CompactPortfolio.
 */

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import CameraIdleSurface from './CameraIdleSurface'
import FieldHealthCard from './FieldHealthCard'
import FieldSolarCard from './FieldSolarCard'
import CameraSourceToggle from './CameraSourceToggle'
import { useFieldTheme } from './fieldTheme'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import { useFundraising } from '@/lib/useFundraising'

const CameraFeedSwitcher = dynamic(() => import('./CameraFeedSwitcher'), {
  ssr: false,
  loading: () => <CameraIdleSurface mode="loading" />,
})

const STLViewer = dynamic(() => import('./STLViewer'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-black/40" />,
})

export type ModalKey =
  | 'about'
  | 'live'
  | 'experience'
  | 'projects'
  | 'marathon'
  | 'contact'
  | 'airpodsmount'

function polishedSurfaceStyle(
  isLight: boolean,
  border: string,
  accentGlow?: string
): CSSProperties {
  return {
    background: accentGlow
      ? isLight
        ? `linear-gradient(135deg, ${accentGlow}, rgba(0,0,0,0.012))`
        : `linear-gradient(135deg, ${accentGlow}, rgba(255,255,255,0.032))`
      : isLight
        ? 'rgba(0,0,0,0.025)'
        : 'rgba(255,255,255,0.03)',
    border,
    boxShadow: isLight
      ? '0 10px 28px rgba(28,26,28,0.045)'
      : '0 14px 34px rgba(0,0,0,0.18)',
  }
}

function Chip({
  children,
  muted = false,
}: {
  children: ReactNode
  muted?: boolean
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <span
      className="rounded-md px-2 py-1 text-[10.5px] sm:text-[11px] font-medium"
      style={{
        background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
        color: muted ? palette.mutedText : palette.bodyText,
      }}
    >
      {children}
    </span>
  )
}

/* ─────────────────── About ─────────────────── */

const ABOUT_TAGS = ['UAV systems', 'Rotor hardware', 'Edge AI', 'Robotics', 'iOS products']

export function AboutModalContent() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={polishedSurfaceStyle(
          isLight,
          palette.cardBorder,
          isLight ? 'rgba(10,138,168,0.055)' : 'rgba(103,232,249,0.075)'
        )}
      >
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 items-center sm:items-start">
        <div
          className="relative w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] rounded-2xl overflow-hidden flex-shrink-0"
          style={{
            boxShadow: isLight
              ? '0 12px 32px rgba(28,26,28,0.18), 0 0 0 1px rgba(0,0,0,0.05)'
              : '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <Image
            src="/images/profile.jpg"
            alt="Andy Sottiaux"
            fill
            sizes="200px"
            className="object-cover"
          />
        </div>
        <div className="flex-1 space-y-3 text-[14px] sm:text-[15px] leading-relaxed" style={{ color: palette.bodyText }}>
          <div
            className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: palette.mutedText }}
          >
            Profile
          </div>
          <p>
            I&apos;m an{' '}
            <span className="font-semibold" style={{ color: isLight ? '#1c1a1c' : '#fff' }}>
              engineer and founder
            </span>{' '}
            who builds across hardware and software. At AVX Aircraft, I&apos;ve designed and manufactured full
            rotor systems and led our subscale UAV and early autonomy work, including CubePilot/CubeNode
            integration and ROS2-based test and control software.
          </p>
          <p>
            I enjoy bridging mechanical design, embedded systems, and hands-on testing, and I bring a
            practical,{' '}
            <span className="font-semibold" style={{ color: isLight ? '#1c1a1c' : '#fff' }}>
              fail-fast mentality
            </span>{' '}
            to moving ideas into real, working aerospace capabilities.
          </p>
          <p>
            Beyond aerospace, I founded{' '}
            <span className="font-semibold" style={{ color: isLight ? '#1c1a1c' : '#fff' }}>
              HatchingPoint
            </span>{' '}
            where I&apos;ve designed and developed 10+ production iPhone apps, built modern web applications,
            and architected robust back-end systems. I thrive at the intersection of hardware and software.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ABOUT_TAGS.map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="w-full flex flex-wrap gap-2">
          <ContactButton
            href="mailto:andrewsottiaux@gmail.com"
            label="Email"
            icon={<EmailIcon />}
          />
          <ContactButton
            href="https://www.linkedin.com/in/andy-sottiaux-593700100/"
            label="LinkedIn"
            external
            icon={<LinkedInIcon />}
          />
          <ContactButton
            href="https://github.com/Andy-Sottiaux"
            label="GitHub"
            external
            icon={<GitHubIcon />}
          />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Field Live ─────────────────── */

const LIVE_PROOF = [
  { label: 'Edge stack', value: 'Linux board, 5 MP camera, on-device inference, thermal/fan health' },
  { label: 'Power stack', value: 'Solar + LiFePO4 telemetry with graceful stale/offline behavior' },
  { label: 'Web stack', value: 'Same-origin Next.js APIs, stream fallback, public read-only surface' },
]

const LIVE_ROLES = ['Hardware integration', 'Embedded services', 'Camera relay', 'Telemetry UI', 'Failure states']

export function LiveModalContent({
  selectedCamera = 'field',
  onCameraChange = () => undefined,
}: {
  selectedCamera?: FieldCameraSource
  onCameraChange?: (value: FieldCameraSource) => void
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const changeCamera = (value: FieldCameraSource) => {
    onCameraChange(value)
  }

  const intro = selectedCamera === 'field'
    ? 'Live edge-AI camera and solar telemetry from a board I built end-to-end: hardware integration, Linux services, relay APIs, and the public read-only stream you are seeing.'
    : 'HatchingPoint-branded Thingino E220 view through the tailnet proxy. The site only consumes a read-only relay; control and device credentials stay off the browser.'

  return (
    <div className="flex flex-col gap-5" data-camera-performance="true">
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={polishedSurfaceStyle(
          isLight,
          palette.cardBorder,
          isLight ? 'rgba(10,138,168,0.055)' : 'rgba(103,232,249,0.075)'
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div
              className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: palette.mutedText }}
            >
              Live System
            </div>
            <div
              className="mt-1.5 text-[16px] sm:text-[18px] font-semibold leading-tight tracking-tight"
              style={{ color: isLight ? '#1c1a1c' : '#fff' }}
            >
              Camera relay, telemetry, and edge-AI health in one surface.
            </div>
            <p className="mt-2 text-[13px] sm:text-[13.5px] leading-snug" style={{ color: palette.bodyText }}>
              {intro}
            </p>
          </div>
          <div className="shrink-0">
            <CameraSourceToggle
              value={selectedCamera}
              onChange={changeCamera}
              isLight={isLight}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {LIVE_ROLES.map((role) => (
            <Chip key={role}>{role}</Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {LIVE_PROOF.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl p-3.5"
            style={polishedSurfaceStyle(isLight, palette.cardBorder)}
          >
            <div
              className="text-[9.5px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: palette.mutedText }}
            >
              {item.label}
            </div>
            <div
              className="mt-1 text-[12px] leading-snug"
              style={{ color: palette.bodyText }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <div
            className="relative w-full overflow-hidden rounded-2xl"
            style={{
              aspectRatio: '16 / 9',
              background: isLight ? '#0a0a0c' : '#000',
              boxShadow: isLight
                ? '0 4px 12px rgba(28,26,28,0.12)'
                : '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <CameraFeedSwitcher
              selectedCamera={selectedCamera}
              enabled
            />
          </div>
        </div>
        <div className="md:col-span-1 [&>div]:h-full">
          <FieldHealthCard />
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
          'Public read-only stream surface',
        ].map((item) => (
          <li
            key={item}
            className="rounded-xl px-2.5 py-2"
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

/* ─────────────────── Experience ─────────────────── */

const EXPERIENCE_FULL = [
  {
    title: 'Senior Engineer-Program Manager I',
    company: 'AVX Aircraft Company',
    companyUrl: 'https://www.avxaircraft.com/',
    period: 'Sep 2023 — Present',
    logo: '/images/avx.png',
    scope: 'Owns cross-discipline UAV execution across rotor hardware, flight-control integration, autonomy scaffolding, and test telemetry.',
    achievements: [
      'Designed and tested rotor hardware for subscale and coaxial UAV platforms',
      'Integrated CubePilot/CubeNode flight-control hardware, sensors, ESCs, and comms',
      'Built test-stand software for acquisition, controls, and real-time telemetry',
      'Prototyped ROS2 autonomy, perception, navigation, and health-monitoring flows',
      'Managed design, fabrication, integration, and test across program risks',
    ],
    skills: ['UAV Systems', 'ROS2', 'CubePilot', 'Rotor Design', 'Autonomy', 'Real-time Telemetry'],
  },
  {
    title: 'Founder / Engineer',
    company: 'HatchingPoint',
    companyUrl: 'https://www.hatchingpoint.com',
    period: 'Jan 2021 — Present',
    logo: '/images/hatchingpoint-logo.jpeg',
    scope: 'Ships production mobile/web products end-to-end, from product shape and UI to backend data models and release operations.',
    achievements: [
      'Designed and shipped 10+ production iPhone apps in Swift and SwiftUI',
      'Built React and TypeScript web apps with component-driven architecture',
      'Architected MongoDB and Supabase back ends for data modeling and real-time flows',
    ],
    skills: ['Swift', 'SwiftUI', 'iOS', 'NFC', 'StoreKit', 'React', 'TypeScript', 'MongoDB', 'Supabase'],
  },
  {
    title: 'Rotor Systems Design Engineer',
    company: 'Bell Flight',
    companyUrl: 'https://www.bellflight.com',
    period: 'Feb 2020 — Sep 2023',
    logo: '/images/bell.svg',
    scope: 'Worked in the rotorcraft engineering loop between CAD, PLM, manufacturing, suppliers, testing, and fleet issue resolution.',
    achievements: [
      'Resolved issues across suppliers, manufacturing, testing, and fleet operations',
      'Produced 2D/3D CAD and PLM documentation for assembly and installation',
      'Supported upstream and downstream engineering through manufacturing and test',
      'Applied CAD, GD&T, FEA, and additive techniques to rotorcraft hardware',
    ],
    skills: ['SOLIDWORKS', 'CAD', 'GD&T', 'FEA', '3D Printing', 'Rotorcraft Engineering'],
  },
  {
    title: 'Project Manager',
    company: 'Texas Air Systems',
    companyUrl: 'https://www.texasairsystems.com/',
    period: 'Aug 2016 — Feb 2020',
    logo: '/images/texasairsystems-logo.jpeg',
    scope: 'Managed technical HVAC projects where requirements, constraints, vendors, and customer expectations had to converge.',
    achievements: [
      'Coordinated customers, contractors, engineers, and manufacturers',
      'Translated requirements and constraints into executable project plans',
      'Investigated field concerns and drove corrective action',
    ],
    skills: ['Project Management', 'HVAC Systems', 'Cross-functional Teams'],
  },
]

const EXPERIENCE_SUMMARY_TAGS = ['Rotor systems', 'UAV autonomy', 'Embedded telemetry', 'iOS/web products']

export function ExperienceModalContent() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={{
          background: isLight
            ? 'linear-gradient(135deg, rgba(0,0,0,0.035), rgba(0,0,0,0.015))'
            : 'linear-gradient(135deg, rgba(103,232,249,0.08), rgba(255,255,255,0.035))',
          border: palette.cardBorder,
        }}
      >
        <div
          className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: palette.mutedText }}
        >
          Operating Range
        </div>
        <div
          className="mt-1.5 text-[16px] sm:text-[18px] font-semibold leading-tight tracking-tight"
          style={{ color: isLight ? '#1c1a1c' : '#fff' }}
        >
          Aircraft hardware, embedded autonomy, and shipped software.
        </div>
        <p
          className="mt-2 text-[12.5px] sm:text-[13.5px] leading-snug"
          style={{ color: palette.bodyText }}
        >
          I work across the full path from design and integration to field test, telemetry, and product release.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXPERIENCE_SUMMARY_TAGS.map((tag) => (
            <span
              key={tag}
              className="rounded-md px-2 py-1 text-[10.5px] sm:text-[11px] font-medium"
              style={{
                background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                color: palette.bodyText,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {EXPERIENCE_FULL.map((exp) => (
        <div
          key={exp.company}
          className="rounded-2xl p-3.5 sm:p-5"
          style={{
            background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.03)',
            border: palette.cardBorder,
          }}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0 p-2 h-11 w-14 sm:h-14 sm:w-20"
              style={{
                background: '#fff',
                border: palette.cardBorder,
              }}
            >
              <Image
                src={exp.logo}
                alt=""
                width={80}
                height={56}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[15px] sm:text-[15.5px] font-semibold leading-tight tracking-tight"
                style={{ color: isLight ? '#1c1a1c' : '#fff' }}
              >
                {exp.title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <a
                  href={exp.companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] sm:text-[13px] leading-tight tracking-tight hover:underline"
                  style={{ color: palette.bodyText }}
                >
                  {exp.company}
                </a>
                <span
                  className="text-[11px] sm:text-[11.5px] tabular-nums leading-tight tracking-tight"
                  style={{ color: palette.mutedText }}
                >
                  {exp.period}
                </span>
              </div>
            </div>
          </div>

          <p
            className="mt-3 text-[12.5px] sm:text-[13px] leading-snug tracking-tight"
            style={{
              color: palette.bodyText,
              borderTop: palette.cardBorder,
              paddingTop: '0.75rem',
            }}
          >
            {exp.scope}
          </p>

          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {exp.achievements.map((a) => (
              <li
                key={a}
                className="flex gap-2 rounded-xl px-2.5 py-2 text-[12px] sm:text-[12.5px] leading-snug"
                style={{
                  color: palette.bodyText,
                  background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.035)',
                  border: palette.hairline ? `1px solid ${palette.hairline}` : palette.cardBorder,
                }}
              >
                <span className="mt-[0.35em] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: palette.mutedText }} />
                <span>{a}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {exp.skills.map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 text-[10px] sm:text-[10.5px] font-medium rounded-md"
                style={{
                  background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                  color: palette.bodyText,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      ))}
      <p
        className="text-[11px] italic text-center pt-2"
        style={{ color: palette.fadedText }}
      >
        Aerospace program details cannot be publicly disclosed. Happy to discuss in appropriate contexts.
      </p>
    </div>
  )
}

/* ─────────────────── Projects ─────────────────── */

const PROJECTS_FULL = [
  {
    title: 'Travel Agent AI',
    problem: 'Make travel planning useful after the booking confirmation, not just during destination search.',
    built: 'Built an iOS trip assistant for bookings, flights, packing lists, calendar sync, itinerary sharing, and trip cost tracking.',
    outcome: 'A polished consumer AI app that turns scattered travel details into one practical mobile planning surface.',
    proof: 'Shows production mobile product execution across AI UX, App Store delivery, subscriptions, CloudKit-style sync patterns, and everyday utility design.',
    tech: ['iOS', 'SwiftUI', 'AI', 'Travel', 'Subscriptions'],
    link: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691',
    icon: '/images/travelagentai-icon.png',
  },
  {
    title: 'WYZECAR',
    problem: 'Turn a small RC platform into a controllable autonomy testbed with live video and person-following behavior.',
    built: 'Integrated YOLOv8 perception, ROS2-style control plumbing, web-based WASD control, live video, and PID motion.',
    outcome: 'A visible robotics demo that makes perception-to-control work inspectable from a browser.',
    proof: 'Shows the robotics loop end-to-end: perception, control, hardware interface, operator UI, and field iteration.',
    tech: ['Python', 'YOLOv8', 'ROS2', 'DART-MX95', 'ESP32'],
    link: 'https://github.com/Andy-Sottiaux/WYZECAR',
    icon: '/images/wyzecar.png',
    iconContain: true,
  },
  {
    title: 'Rot Dot',
    problem: 'Create real physical friction for phone distraction without making the app feel like a punishment tool.',
    built: 'Used NFC stickers, SwiftUI, FamilyControls, and the Screen Time API to bind lock/unlock behavior to places.',
    outcome: 'A shipped iOS product built around a physical-world interaction instead of another timer screen.',
    proof: 'Combines product judgment with a restricted Apple API surface and real-world interaction design.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'NFC', 'FamilyControls'],
    link: 'https://apps.apple.com/us/app/rot-dot/id6758902103',
    icon: '/images/rotdot-icon.png',
  },
  {
    title: 'Record + Transcribe',
    problem: 'Make long voice notes and meetings useful immediately after capture.',
    built: 'Built recording, live transcription, and AI summary flows that extract decisions, key points, and action items.',
    outcome: 'A production AI utility that turns raw audio capture into immediately usable notes.',
    proof: 'Demonstrates a production mobile AI workflow: capture, streaming text, summary UX, and shipped App Store release.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'Speech Recognition', 'OpenAI'],
    link: 'https://apps.apple.com/app/record-transcribe/id6758643630',
    icon: '/images/recordtranscribe-icon.png',
  },
  {
    title: 'AirMD+',
    problem: 'Expose HVAC behavior as live telemetry instead of intermittent technician observations.',
    built: 'Built the custom monitoring hardware path plus iOS and web surfaces for temperature tracking and system visibility.',
    outcome: 'An embedded-to-app monitoring path for operational visibility outside the lab.',
    proof: 'Bridges embedded data collection, full-stack product work, and a practical operational monitoring use case.',
    tech: ['iOS', 'Swift', 'Hardware', 'IoT', 'Embedded'],
    link: 'https://www.hatchingpoint.com/airmd',
    icon: '/images/airmd-icon.jpg',
  },
]

const SECONDARY_PROJECTS = [
  { name: 'LevelUp+', description: 'Habit and goal tracker with streaks and reminders.', tech: ['iOS', 'SwiftUI'] },
  { name: 'Caffeine Rhythm', description: 'Caffeine half-life tracking to time your day better.', tech: ['iOS', 'SwiftUI', 'HealthKit'] },
  { name: 'AirPods Pro 3 Tesla Mount', description: 'Custom 3D-printed holder positioning AirPods Pro 3 at the right height for Tesla wireless chargers.', tech: ['SOLIDWORKS', '3D Printing'] },
]

const PROJECT_SUMMARY_TAGS = ['Robotics', 'Production iOS', 'AI UX', 'Embedded telemetry', 'CAD artifacts']

export function ProjectsModalContent() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={polishedSurfaceStyle(
          isLight,
          palette.cardBorder,
          isLight ? 'rgba(180,83,9,0.055)' : 'rgba(252,211,77,0.075)'
        )}
      >
        <div
          className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: palette.mutedText }}
        >
          Project Range
        </div>
        <div
          className="mt-1.5 text-[16px] sm:text-[18px] font-semibold leading-tight tracking-tight"
          style={{ color: isLight ? '#1c1a1c' : '#fff' }}
        >
          Shipped apps, visible robotics, and hardware-adjacent tools.
        </div>
        <p
          className="mt-2 text-[12.5px] sm:text-[13.5px] leading-snug"
          style={{ color: palette.bodyText }}
        >
          The strongest work here shows the full loop: product judgment, implementation, release, and real-world integration.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PROJECT_SUMMARY_TAGS.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROJECTS_FULL.map((p) => {
          const details = [
            { label: 'Problem', value: p.problem },
            { label: 'Built', value: p.built },
            { label: 'Outcome', value: p.outcome },
            { label: 'Proof', value: p.proof },
          ]

          return (
            <a
              key={p.title}
              href={p.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl p-3.5 sm:p-4 transition-all hover:scale-[1.01] flex flex-col"
              style={polishedSurfaceStyle(isLight, palette.cardBorder)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`${p.iconContain ? 'h-14 w-20 sm:h-16 sm:w-24' : 'h-14 w-14 sm:h-16 sm:w-16'} rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center`}
                  style={{
                    border: palette.cardBorder,
                    background: isLight ? '#fff' : 'rgba(255,255,255,0.92)',
                    boxShadow: isLight
                      ? '0 8px 20px rgba(28,26,28,0.08)'
                      : '0 12px 26px rgba(0,0,0,0.24)',
                  }}
                >
                  <Image
                    src={p.icon}
                    alt=""
                    width={96}
                    height={64}
                    className={`w-full h-full ${p.iconContain ? 'object-contain p-2' : 'object-cover'}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[16px] sm:text-[17px] font-semibold leading-tight tracking-tight"
                    style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                  >
                    {p.title}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.tech.slice(0, 3).map((t) => (
                      <Chip key={t} muted>{t}</Chip>
                    ))}
                  </div>
                </div>
                <svg
                  className="mt-1 h-4 w-4 flex-shrink-0 opacity-45 transition-all group-hover:translate-x-0.5 group-hover:opacity-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{ color: palette.mutedText }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                {details.map((detail) => (
                  <div
                    key={detail.label}
                    className="rounded-xl px-2.5 py-2"
                    style={{
                      background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.035)',
                      border: palette.hairline ? `1px solid ${palette.hairline}` : palette.cardBorder,
                    }}
                  >
                    <div
                      className="text-[9px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: palette.mutedText }}
                    >
                      {detail.label}
                    </div>
                    <p
                      className="mt-1 text-[12px] sm:text-[12.5px] leading-snug"
                      style={{ color: palette.bodyText }}
                    >
                      {detail.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tech.slice(3).map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </a>
          )
        })}
      </div>

      <div className="pt-3" style={{ borderTop: palette.cardBorder }}>
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.22em] mb-2.5"
          style={{ color: palette.mutedText }}
        >
          More projects
        </div>
        <div className="grid grid-cols-1 gap-2">
          {SECONDARY_PROJECTS.map((p) => (
            <div
              key={p.name}
              className="rounded-2xl px-3 py-2.5 sm:flex sm:items-start sm:justify-between sm:gap-3"
              style={polishedSurfaceStyle(isLight, palette.cardBorder)}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-semibold leading-tight tracking-tight"
                  style={{ color: isLight ? '#1c1a1c' : '#fff' }}
                >
                  {p.name}
                </div>
                <div
                  className="mt-1 text-[12px] leading-snug tracking-tight"
                  style={{ color: palette.bodyText }}
                >
                  {p.description}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 sm:mt-0 sm:flex-shrink-0">
                {p.tech.map((t) => (
                  <Chip key={t} muted>{t}</Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <a
        href="https://www.hatchingpoint.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-[12px] tracking-tight pt-2 hover:opacity-100 opacity-70 transition-opacity"
        style={{ color: palette.mutedText }}
      >
        More iOS apps on the App Store →
      </a>
    </div>
  )
}

/* ─────────────────── Marathon ─────────────────── */

const MARATHON_DATE = new Date('2026-11-01T00:00:00')

export function MarathonModalContent() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const { raised, goal } = useFundraising()

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff = Math.max(0, MARATHON_DATE.getTime() - now.getTime())
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  const pct = Math.min(100, Math.round((raised / goal) * 100))

  return (
    <div className="space-y-5">
      <div className="rounded-2xl overflow-hidden bg-[#E8642C]">
        <div className="flex flex-col sm:flex-row items-stretch">
          <div className="bg-white flex items-center justify-center px-6 py-4 sm:py-5 sm:w-44 flex-shrink-0">
            <Image
              src="/images/tcs-marathon-logo.png"
              alt="2026 TCS New York City Marathon"
              width={140}
              height={92}
              className="h-16 sm:h-20 w-auto object-contain"
            />
          </div>
          <div className="flex-1 px-5 py-4 sm:py-5">
            <div className="text-white/70 text-[10px] font-semibold tracking-[0.18em] uppercase">
              2026 TCS New York City Marathon
            </div>
            <div className="text-white font-bold text-[18px] sm:text-[20px] mt-0.5">
              Running for Team for Kids
            </div>
            <div className="text-white/70 text-[12px] mt-0.5">
              Free youth running programs across NYC
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { v: days, l: 'DAYS' },
          { v: hours, l: 'HRS' },
          { v: minutes, l: 'MIN' },
          { v: seconds, l: 'SEC' },
        ].map((c) => (
          <div
            key={c.l}
            className="text-center rounded-2xl py-3"
            style={polishedSurfaceStyle(isLight, palette.cardBorder)}
          >
            <div
              className="text-[24px] sm:text-[28px] font-semibold leading-none tabular-nums tracking-tight"
              style={{
                backgroundImage: palette.headlineGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {c.v}
            </div>
            <div
              className="text-[9.5px] font-semibold tracking-[0.18em] mt-1.5"
              style={{ color: palette.mutedText }}
            >
              {c.l}
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-3.5 sm:p-4"
        style={polishedSurfaceStyle(isLight, palette.cardBorder)}
      >
        <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: palette.trackBackground }}>
          <div
            className="h-full rounded-full"
            style={{
              width: '100%',
              transform: `scaleX(${pct / 100})`,
              transformOrigin: 'left',
              background: 'linear-gradient(90deg, #E8642C 0%, #ffb84d 100%)',
              boxShadow: '0 0 12px rgba(232,100,44,0.35)',
              transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-[14px] font-semibold tabular-nums tracking-tight" style={{ color: isLight ? '#1c1a1c' : '#fff' }}>
            ${raised.toLocaleString()}
            <span className="font-normal ml-1.5" style={{ color: palette.mutedText }}>
              of ${goal.toLocaleString()}
            </span>
          </div>
          <div
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: palette.mutedText }}
          >
            {pct}%
          </div>
        </div>
      </div>

      <div
        className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl p-3.5 sm:p-4"
        style={polishedSurfaceStyle(isLight, palette.cardBorder)}
      >
        <a
          href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 w-full sm:w-auto text-center px-5 py-3 rounded-xl text-[14px] font-bold tracking-tight transition-all hover:opacity-90"
          style={{
            background: 'linear-gradient(180deg, #E8642C, #d05722)',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(232,100,44,0.3)',
          }}
        >
          Donate to Team for Kids
        </a>
        <div className="flex items-center gap-3">
          <Image
            src="/images/nyrr-qr.png"
            alt="Scan to donate"
            width={64}
            height={64}
            className="w-16 h-16 rounded-md"
            style={{ background: '#fff', padding: 2 }}
          />
          <div
            className="text-[11px] leading-snug max-w-[140px]"
            style={{ color: palette.mutedText }}
          >
            Scan to donate from your phone
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Contact ─────────────────── */

export function ContactModalContent() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={polishedSurfaceStyle(
          isLight,
          palette.cardBorder,
          isLight ? 'rgba(10,138,168,0.055)' : 'rgba(103,232,249,0.075)'
        )}
      >
        <div
          className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: palette.mutedText }}
        >
          Best Fit
        </div>
        <div
          className="mt-1.5 text-[16px] sm:text-[18px] font-semibold leading-tight tracking-tight"
          style={{ color: isLight ? '#1c1a1c' : '#fff' }}
        >
          Hardware/software integration with real product execution.
        </div>
        <p
          className="mt-2 text-[13px] sm:text-[13.5px] leading-snug"
          style={{ color: palette.bodyText }}
        >
          UAV systems, embedded dashboards, rapid prototypes, and production apps that need both engineering depth and practical delivery.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <ContactButton
          href="mailto:andrewsottiaux@gmail.com"
          label="Email"
          sub="andrewsottiaux@gmail.com"
          icon={<EmailIcon />}
          large
        />
        <ContactButton
          href="https://www.linkedin.com/in/andy-sottiaux-593700100/"
          label="LinkedIn"
          sub="andy-sottiaux-593700100"
          external
          icon={<LinkedInIcon />}
          large
        />
        <ContactButton
          href="https://github.com/Andy-Sottiaux"
          label="GitHub"
          sub="Andy-Sottiaux"
          external
          icon={<GitHubIcon />}
          large
        />
        <ContactButton
          href="https://www.hatchingpoint.com/"
          label="HatchingPoint"
          sub="hatchingpoint.com"
          external
          icon={<WebsiteIcon />}
          large
        />
      </div>

      <div
        className="text-[11px] tracking-wide text-center pt-3"
        style={{ color: palette.fadedText, borderTop: palette.cardBorder }}
      >
        B.S. Mechanical Engineering · Texas Tech University, 2016
      </div>
    </div>
  )
}

/* ─────────────────── Shared bits ─────────────────── */

function ContactButton({
  href,
  label,
  sub,
  icon,
  external,
  large,
}: {
  href: string
  label: string
  sub?: string
  icon: React.ReactNode
  external?: boolean
  large?: boolean
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={`group flex items-center gap-3 rounded-2xl transition-all hover:scale-[1.01] ${large ? 'px-4 py-3.5' : 'px-3 py-2.5'}`}
      style={{
        ...polishedSurfaceStyle(isLight, palette.cardBorder),
        color: isLight ? '#1c1a1c' : '#fff',
      }}
    >
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:-translate-y-0.5 ${large ? 'h-10 w-10' : 'h-8 w-8'}`}
        style={{
          background: isLight ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.06)',
          color: isLight ? '#1c1a1c' : '#fff',
        }}
      >
        <div className={large ? 'h-5 w-5 opacity-90' : 'h-4 w-4 opacity-90'}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`${large ? 'text-[13.5px]' : 'text-[12px]'} font-semibold tracking-tight`}>
          {label}
        </div>
        {sub && (
          <div
            className="text-[11px] truncate"
            style={{ color: palette.mutedText }}
          >
            {sub}
          </div>
        )}
      </div>
    </a>
  )
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

/* ───────────────────── AirPods Tesla Mount modal ──────────────────── */

const AIRPODS_MOUNT_DOWNLOADS: { label: string; href: string }[] = [
  { label: 'STL', href: '/files/AirPods Pro 3_Teslav2.STL' },
  { label: 'SLDPRT', href: '/files/AirPods Pro 3_Teslav2.SLDPRT' },
]

const AIRPODS_MOUNT_STL_URLS = [
  '/files/assembly-mount.STL',
  '/files/assembly-airpods.STL',
]

/** CAD mini-modal for the AirPods Pro 3 Tesla wireless-charger mount.
 *  Mirrors the "featured design" panel from the old home page: live
 *  STL viewer + STL/SLDPRT downloads + a tip jar. */
export function AirpodsMountModalContent() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div className="flex flex-col gap-5">
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '16 / 10',
          background: isLight ? '#f5f5f7' : '#0a0a0c',
          boxShadow: isLight
            ? '0 8px 24px rgba(28,26,28,0.10), inset 0 0 0 1px rgba(0,0,0,0.05)'
            : '0 16px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <STLViewer urls={AIRPODS_MOUNT_STL_URLS} />
      </div>

      <div
        className="rounded-2xl p-4 sm:p-5"
        style={polishedSurfaceStyle(
          isLight,
          palette.cardBorder,
          isLight ? 'rgba(10,138,168,0.045)' : 'rgba(103,232,249,0.065)'
        )}
      >
        <div
          className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: palette.mutedText }}
        >
          CAD Artifact
        </div>
        <div
          className="mt-1.5 text-[16px] sm:text-[18px] font-semibold leading-tight tracking-tight"
          style={{ color: isLight ? '#1c1a1c' : '#fff' }}
        >
          AirPods Pro 3 Tesla wireless-charger mount.
        </div>
        <p
          className="mt-2 text-[13px] sm:text-[13.5px] leading-snug"
          style={{ color: palette.bodyText }}
        >
          Custom mount that positions AirPods Pro 3 at the correct height
          for Tesla wireless chargers. SOLIDWORKS source + STL — free to
          download, print, and modify.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['SOLIDWORKS', '3D Printing', 'CAD'].map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {AIRPODS_MOUNT_DOWNLOADS.map((d) => (
          <a
            key={d.label}
            href={d.href}
            download
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold tracking-tight transition-opacity hover:opacity-85"
            style={{
              background: isLight ? '#1c1a1c' : '#fff',
              color: isLight ? '#fff' : '#1c1a1c',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
            </svg>
            {d.label}
          </a>
        ))}
        <a
          href="https://venmo.com/u/andysottiaux"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium tracking-tight transition-colors"
          style={{
            background: 'transparent',
            color: palette.bodyText,
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.16)'}`,
          }}
        >
          Tip designer
        </a>
      </div>
    </div>
  )
}
