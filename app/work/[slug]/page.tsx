import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, CheckCircle2, CircleDot, Radio } from 'lucide-react'
import { FEATURED_CASE_STUDIES, getCaseStudy } from '@/content/caseStudies'
import EpaperProductViewer from '@/components/EpaperProductViewer'

const FIELD_SYSTEM_NODES = ['Edge camera', 'Private relay', 'Public gateway', 'Portfolio UI']

type WorkPageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return FEATURED_CASE_STUDIES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const project = getCaseStudy((await params).slug)
  if (!project) return {}

  return {
    title: project.title,
    description: `${project.problem} ${project.outcome}`,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: `${project.title} | Andy Sottiaux`,
      description: project.subtitle,
      url: `/work/${project.slug}`,
      images: project.heroImage ? [{ url: project.heroImage, alt: project.heroImageAlt }] : undefined,
    },
  }
}

export default async function WorkPage({ params }: WorkPageProps) {
  const project = getCaseStudy((await params).slug)
  if (!project) notFound()

  const external = project.link.startsWith('http')

  return (
    <main id="main-content" className="min-h-screen bg-[#07080b] text-white">
      <nav className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/85 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Andy Sottiaux
          </Link>
          <div className="flex items-center gap-4 text-xs font-semibold text-white/70">
            <Link href="/lab" className="transition-colors hover:text-white">Live lab</Link>
            <a href="mailto:andrewsottiaux@gmail.com" className="transition-colors hover:text-white">Contact</a>
          </div>
        </div>
      </nav>

      <section className="relative flex min-h-[72svh] items-end overflow-hidden border-b border-white/10">
        <HeroVisual project={project} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080b] via-[#07080b]/55 to-black/20" />
        <div className="relative z-20 mx-auto w-full max-w-[1180px] px-5 pb-12 pt-28 sm:px-8 sm:pb-16">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase text-cyan-300">{project.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-6xl">{project.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{project.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={project.link}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-white px-4 py-2.5 text-sm font-semibold text-[#111318] transition-colors hover:bg-cyan-100"
              >
                {project.linkLabel ?? 'Open project'}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                href="/#projects"
                className="inline-flex min-h-11 items-center rounded-[8px] border border-white/20 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white/85 backdrop-blur-sm transition-colors hover:border-white/40 hover:text-white"
              >
                All projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 px-5 sm:grid-cols-4 sm:px-8">
          {project.metrics.map((metric, index) => (
            <div key={metric} className="border-white/10 px-0 py-6 pr-4 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0">
              <div className="text-[10px] font-semibold uppercase text-white/50">Evidence {index + 1}</div>
              <div className="mt-1.5 text-sm font-semibold text-white/90">{metric}</div>
            </div>
          ))}
        </div>
      </section>

      {project.tour ? <CapabilityTour tour={project.tour} /> : null}

      <section className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[0.85fr_1.4fr] md:py-20">
        <div>
          <SectionLabel>Scope</SectionLabel>
          <h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">What I owned</h2>
        </div>
        <div className="space-y-6 text-[15px] leading-relaxed text-white/72">
          <p className="text-lg leading-relaxed text-white/90">{project.role}</p>
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-semibold text-white">Problem</h3>
            <p className="mt-2">{project.problem}</p>
          </div>
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-semibold text-white">Built</h3>
            <p className="mt-2">{project.built}</p>
          </div>
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-semibold text-white">Outcome</h3>
            <p className="mt-2">{project.outcome}</p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0b0d11]">
        <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 md:py-20">
          <SectionLabel>Engineering constraints</SectionLabel>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight sm:text-3xl">The conditions that shaped the system</h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[8px] border border-white/10 bg-white/10 md:grid-cols-3">
            {project.constraints?.map((constraint, index) => (
              <div key={constraint} className="bg-[#0b0d11] p-5 sm:p-6">
                <div className="font-mono text-xs text-cyan-300">0{index + 1}</div>
                <p className="mt-4 text-sm leading-relaxed text-white/72">{constraint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 md:py-20">
        <SectionLabel>Key decisions</SectionLabel>
        <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Tradeoffs made explicit</h2>
        <div className="mt-9 divide-y divide-white/10 border-y border-white/10">
          {project.decisions?.map((decision, index) => (
            <div key={decision.title} className="grid gap-3 py-6 md:grid-cols-[72px_0.65fr_1.35fr] md:gap-6">
              <div className="font-mono text-xs text-white/55">0{index + 1}</div>
              <h3 className="text-base font-semibold text-white/95">{decision.title}</h3>
              <p className="text-sm leading-relaxed text-white/68">{decision.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0b0d11]">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 md:py-20">
          <EvidenceList title="Architecture" items={project.architecture} icon="architecture" />
          <EvidenceList title="Validation" items={project.validation} icon="validation" />
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 md:py-20">
        <SectionLabel>Stack</SectionLabel>
        <div className="mt-5 flex flex-wrap gap-2">
          {project.tech.map((item) => (
            <span key={item} className="rounded-[6px] border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/72">
              {item}
            </span>
          ))}
        </div>
        <div className="mt-14 flex flex-col justify-between gap-5 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs font-semibold uppercase text-white/55">Result</div>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/78">{project.proof}</p>
          </div>
          <a
            href={project.link}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#071012] hover:bg-cyan-200"
          >
            {project.linkLabel ?? 'Open project'}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  )
}

function HeroVisual({ project }: { project: NonNullable<ReturnType<typeof getCaseStudy>> }) {
  if (project.heroMode === 'gallery' && project.heroGallery?.length) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#e8e3db]">
        <div className="absolute inset-y-8 right-[-14%] flex items-center gap-3 sm:inset-y-10 sm:right-[2%] sm:gap-5">
          {project.heroGallery.map((image, index) => (
            <div
              key={image}
              className={`relative aspect-[6/13] h-[74%] min-h-[300px] max-h-[610px] shrink-0 overflow-hidden rounded-[8px] border border-black/10 bg-white shadow-2xl ${index > 0 ? 'hidden sm:block' : ''}`}
            >
              <Image
                src={image}
                alt={`${project.title} product screen ${index + 1}`}
                fill
                priority={index === 0}
                sizes="(max-width: 640px) 70vw, 28vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (project.heroMode === 'system') {
    return (
      <div className="absolute inset-0 bg-[#090c10]">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-x-5 top-24 mx-auto grid max-w-5xl grid-cols-2 gap-3 opacity-75 sm:inset-x-8 sm:grid-cols-4">
          {FIELD_SYSTEM_NODES.map((node, index) => (
            <div key={node} className="relative border border-cyan-200/25 bg-cyan-200/[0.045] px-4 py-5">
              <Radio className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              <div className="mt-5 font-mono text-[10px] text-cyan-200/55">NODE 0{index + 1}</div>
              <div className="mt-1 text-sm font-semibold text-white/80">{node}</div>
              {index < FIELD_SYSTEM_NODES.length - 1 && <div className="absolute -right-3 top-1/2 hidden h-px w-3 bg-cyan-200/30 sm:block" />}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (project.heroMode === 'epaper' && project.heroImage) {
    return (
      <div className="absolute inset-0">
        <EpaperProductViewer dashboardSrc={project.heroImage} dashboardAlt={project.heroImageAlt ?? ''} />
      </div>
    )
  }

  if (!project.heroImage) return <div className="absolute inset-0 bg-[#0b0d11]" />

  return (
    <div className={`absolute inset-0 ${project.heroMode === 'contain' ? 'bg-white' : 'bg-black'}`}>
      <Image
        src={project.heroImage}
        alt={project.heroImageAlt ?? ''}
        fill
        priority
        sizes="100vw"
        className={project.heroMode === 'contain' ? 'object-contain p-8 sm:p-14' : 'object-cover'}
      />
    </div>
  )
}

function CapabilityTour({
  tour,
}: {
  tour: NonNullable<NonNullable<ReturnType<typeof getCaseStudy>>['tour']>
}) {
  const markerColors = {
    red: 'border-[#c21c25] bg-[#c21c25] text-white',
    yellow: 'border-[#f4c20d] bg-[#f4c20d] text-[#17130a]',
    black: 'border-[#17191d] bg-[#17191d] text-white',
  }

  return (
    <section id="capability-tour" className="scroll-mt-6 border-b border-[#1a1815]/15 bg-[#eee9df] text-[#17191d]">
      <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 md:py-20">
        <div className="grid gap-5 md:grid-cols-[0.78fr_1.22fr] md:items-end">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b4232d]">Interface tour</div>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">{tour.title}</h2>
          </div>
          <p className="max-w-2xl text-[15px] leading-relaxed text-[#17191d]/68 md:justify-self-end">{tour.intro}</p>
        </div>

        <div className="mt-9 rounded-[14px] bg-[#111216] p-2.5 shadow-[0_26px_70px_rgba(31,27,22,0.24)] sm:p-4">
          <div className="mb-2.5 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-[0.13em] text-white/60 sm:mb-3">
            <span>Native dashboard canvas</span>
            <span>1360 × 480 · four-color e-paper</span>
          </div>
          <div className="relative aspect-[17/6] overflow-hidden rounded-[6px] bg-white">
            <Image
              src={tour.image}
              alt={tour.imageAlt}
              fill
              sizes="(max-width: 1180px) 94vw, 1148px"
              className="object-contain"
            />
            {tour.stops.map((stop, index) => stop.marker ? (
              <div
                key={stop.title}
                aria-hidden="true"
                className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.35)] sm:h-9 sm:w-9 sm:text-xs ${markerColors[stop.accent ?? 'black']}`}
                style={{ left: `${stop.marker.x}%`, top: `${stop.marker.y}%` }}
              >
                {index + 1}
              </div>
            ) : null)}
          </div>
        </div>

        <ol className="mt-8 grid gap-px overflow-hidden rounded-[10px] border border-[#17191d]/15 bg-[#17191d]/15 sm:grid-cols-2 lg:grid-cols-3">
          {tour.stops.map((stop, index) => (
            <li key={stop.title} className="bg-[#f7f3ea] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${markerColors[stop.accent ?? 'black']}`}>
                  {index + 1}
                </span>
                <h3 className="text-sm font-semibold">{stop.title}</h3>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[#17191d]/65">{stop.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase text-cyan-300">{children}</div>
}

function EvidenceList({
  title,
  items,
  icon,
}: {
  title: string
  items: string[]
  icon: 'architecture' | 'validation'
}) {
  const Icon = icon === 'validation' ? CheckCircle2 : CircleDot
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 py-4">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
            <span className="text-sm leading-relaxed text-white/72">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
