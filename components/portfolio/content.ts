import type { ModalKey } from '../CompactModals'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'

export type SpotlightItem = {
  id: string
  kind: 'camera' | 'project'
  eyebrow: string
  title: string
  railLabel?: string
  subtitle: string
  description: string
  accent: { light: string; dark: string }
  halo?: { light: string; dark: string }
  modal: ModalKey
  camera?: FieldCameraSource
  icon?: string
  iconContain?: boolean
  previewImage?: string
  previewAlt?: string
  href?: string
  cta?: string
  caseStudyHref?: string
}

type ExperienceItem = {
  title: string
  company: string
  period: string
  shortPeriod: string
  url: string
  current?: boolean
  logo: string
  scale?: number
}

type ProjectItem = {
  name: string
  desc: string
  url: string
  icon: string
  round?: boolean
  external?: boolean
}

export type ContactIcon = 'email' | 'linkedin' | 'github' | 'hatchingpoint'

type ContactLink = {
  label: string
  href: string
  icon: ContactIcon
}

export const SPOTLIGHT_ROTATION_MS = 3500

export const SPOTLIGHT_ITEMS: SpotlightItem[] = [
  {
    id: 'epaper-dashboard',
    kind: 'project',
    eyebrow: 'Embedded display',
    title: 'E-Paper Dashboard',
    railLabel: 'E-Paper',
    subtitle: 'Runner-first command center',
    description: 'Runna, Strava, weather, and race day on a four-color display.',
    accent: { light: '#b4232d', dark: 'rgba(248, 113, 113, 0.95)' },
    halo: { light: 'rgba(244, 194, 13, 0.2)', dark: 'rgba(244, 194, 13, 0.17)' },
    modal: 'projects',
    icon: '/images/epaper-dashboard-frame.png',
    iconContain: true,
    previewImage: '/images/epaper-dashboard-frame.png',
    previewAlt: 'Four-color runner dashboard shown on a 10.85-inch e-paper canvas',
    caseStudyHref: '/work/epaper-dashboard',
  },
  {
    id: 'travel-agent-ai',
    kind: 'project',
    eyebrow: 'Featured app',
    title: 'Travel Agent AI',
    railLabel: 'Travel',
    subtitle: 'AI-powered trip planner',
    description: 'Capture bookings, review the details, and share an itinerary.',
    accent: { light: '#2563eb', dark: 'rgba(147, 197, 253, 0.95)' },
    halo: { light: 'rgba(37, 99, 235, 0.16)', dark: 'rgba(147, 197, 253, 0.18)' },
    modal: 'projects',
    icon: '/images/travelagentai-icon.png',
    href: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691',
    cta: 'App Store',
    caseStudyHref: '/work/travel-agent-ai',
  },
  {
    id: 'cam1',
    kind: 'camera',
    eyebrow: 'Clean live',
    title: 'Cam 1',
    subtitle: 'Edge-AI field camera',
    description: 'Solar-powered edge AI, live video, and system telemetry.',
    accent: { light: '#0a8aa8', dark: 'rgba(103, 232, 249, 0.9)' },
    modal: 'live',
    camera: 'field',
  },
  {
    id: 'wyzecar',
    kind: 'project',
    eyebrow: 'Robotics',
    title: 'WYZECAR',
    railLabel: 'WYZECAR',
    subtitle: 'Vision RC autonomy',
    description: 'YOLOv8 vision, browser control, and visual-servoing experiments.',
    accent: { light: '#b45309', dark: 'rgba(252, 211, 77, 0.95)' },
    halo: { light: 'rgba(180, 83, 9, 0.16)', dark: 'rgba(252, 211, 77, 0.18)' },
    modal: 'projects',
    icon: '/images/wyzecar.png',
    iconContain: true,
    href: 'https://github.com/Andy-Sottiaux/WYZECAR',
    cta: 'GitHub',
    caseStudyHref: '/work/wyzecar',
  },
  {
    id: 'cam2',
    kind: 'camera',
    eyebrow: 'PTZ relay',
    title: 'Cam 2',
    subtitle: 'Thingino pan / tilt',
    description: 'Thingino camera with browser pan and tilt.',
    accent: { light: '#10a366', dark: 'rgba(134, 239, 172, 0.92)' },
    modal: 'live',
    camera: 'thingino',
  },
]

export const EXPERIENCE_ITEMS: ExperienceItem[] = [
  {
    title: 'Senior Engineer',
    company: 'AVX Aircraft',
    period: 'Sep 2023 — Present',
    shortPeriod: '2023–now',
    url: 'https://www.avxaircraft.com/',
    current: true,
    logo: '/images/avx.png',
    scale: 1.0,
  },
  {
    title: 'Founder',
    company: 'HatchingPoint',
    period: '2021 — Present',
    shortPeriod: '2021–now',
    url: 'https://www.hatchingpoint.com',
    logo: '/images/hatchingpoint-logo.jpeg',
    scale: 1.05,
  },
  {
    title: 'Rotor Systems',
    company: 'Bell Flight',
    period: '2020 — 2023',
    shortPeriod: '2020–2023',
    url: 'https://www.bellflight.com',
    logo: '/images/bell.svg',
    scale: 1.05,
  },
  {
    title: 'Project Manager',
    company: 'Texas Air Systems',
    period: '2016 — 2020',
    shortPeriod: '2016–2020',
    url: 'https://www.texasairsystems.com/',
    logo: '/images/texasairsystems-logo.jpeg',
    scale: 1.0,
  },
]

export const PROJECT_ITEMS: ProjectItem[] = [
  {
    name: 'Travel Agent AI',
    desc: 'Bookings & shared trips · iOS',
    url: '/work/travel-agent-ai',
    icon: '/images/travelagentai-icon.png',
  },
  {
    name: 'WYZECAR',
    desc: 'Vision-guided RC car · YOLOv8',
    url: '/work/wyzecar',
    icon: '/images/wyzecar.png',
    round: true,
  },
  {
    name: 'Record + Transcribe',
    desc: 'Voice notes with AI summaries',
    url: 'https://apps.apple.com/app/record-transcribe/id6758643630',
    icon: '/images/recordtranscribe-icon.png',
    external: true,
  },
]

export const CONTACT_LINKS: ContactLink[] = [
  {
    label: 'Email',
    href: 'mailto:andrewsottiaux@gmail.com',
    icon: 'email',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/andy-sottiaux-593700100/',
    icon: 'linkedin',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/Andy-Sottiaux',
    icon: 'github',
  },
  {
    label: 'HatchingPoint',
    href: 'https://www.hatchingpoint.com/',
    icon: 'hatchingpoint',
  },
]

export const COPYRIGHT_YEAR = 2026
export const MARATHON_DATE = new Date('2026-11-01T00:00:00')
