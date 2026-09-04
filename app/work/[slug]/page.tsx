import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, CircleDot, Radio } from 'lucide-react'
import { FEATURED_CASE_STUDIES, getCaseStudy } from '@/content/caseStudies'
import EpaperProductViewer from '@/components/EpaperProductViewer'
import styles from './work.module.css'

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
  const projectIndex = FEATURED_CASE_STUDIES.findIndex(({ slug }) => slug === project.slug)
  const nextProject = FEATURED_CASE_STUDIES[(projectIndex + 1) % FEATURED_CASE_STUDIES.length]

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.navigation} aria-label="Main navigation">
          <Link href="/" className={styles.wordmark}>Andy Sottiaux<span aria-hidden="true">.</span></Link>
          <div className={styles.navLinks}>
            <Link href="/#projects">Selected work</Link>
            <Link href="/#about">About</Link>
            <Link href="/lab">Live lab</Link>
            <Link href="/#contact">Contact <ArrowUpRight size={13} aria-hidden="true" /></Link>
          </div>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="project-title">
        <div className={styles.heroCopy}>
          <Link href="/#projects" className={styles.backLink}>
            <ArrowLeft size={14} aria-hidden="true" /> Selected work
            <span>{String(projectIndex + 1).padStart(2, '0')} / {String(FEATURED_CASE_STUDIES.length).padStart(2, '0')}</span>
          </Link>
          <p className={styles.eyebrow}>{project.eyebrow}</p>
          <h1 id="project-title">{project.title}</h1>
          <p className={styles.subtitle}>{project.subtitle}</p>
          <div className={styles.heroActions}>
            <a href={project.link} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={styles.primaryLink}>
              {project.linkLabel ?? 'Open project'}<ArrowUpRight size={17} aria-hidden="true" />
            </a>
            <a href="#overview" className={styles.textLink}>Read the case study <ArrowDown size={15} aria-hidden="true" /></a>
          </div>
        </div>
        <div className={styles.heroMedia}>
          <div className={`${styles.visualFrame} ${project.heroMode === 'epaper' ? styles.epaperFrame : ''}`}><HeroVisual project={project} /></div>
          <div className={styles.visualCaption}>
            <span>{project.heroMode === 'system' ? 'System topology' : project.heroMode === 'epaper' ? 'Interactive product view' : 'Inside the product'}</span>
            <span>{project.heroMode === 'system' ? 'Edge → interface' : project.heroMode === 'epaper' ? '1360 × 480 / four-color' : project.heroMode === 'gallery' ? 'Native iOS' : 'Hardware + software'}</span>
          </div>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Project evidence">
        {project.metrics.map((metric, index) => (
          <div key={metric}><span className={styles.metricIndex}>0{index + 1} /</span><p>{metric}</p></div>
        ))}
      </section>
      <nav className={styles.sectionNav} aria-label="Case study sections">
        <a href="#overview">01 <span>Overview</span></a>
        <a href="#decisions">02 <span>Decisions</span></a>
        <a href="#engineering">03 <span>Engineering</span></a>
        <a href="#result">04 <span>Result</span></a>
      </nav>

      {project.tour ? <CapabilityTour tour={project.tour} /> : null}

      <section id="overview" className={`${styles.section} ${styles.overview}`}>
        <div className={styles.sectionIntro}>
          <SectionLabel>01 / Scope</SectionLabel><h2>What I owned</h2><p className={styles.role}>{project.role}</p>
        </div>
        <div className={styles.narrative}>
          <div><h3>Problem</h3><p>{project.problem}</p></div>
          <div><h3>Built</h3><p>{project.built}</p></div>
          <div><h3>Outcome</h3><p>{project.outcome}</p></div>
        </div>
      </section>

      <section className={styles.constraintBand}>
        <div className={styles.section}>
          <div className={styles.sectionHeading}>
            <SectionLabel>Engineering constraints</SectionLabel><h2>The conditions that<br />shaped the <em>system.</em></h2>
          </div>
          <div className={styles.constraints}>
            {project.constraints?.map((constraint, index) => <div key={constraint}><span>0{index + 1}</span><p>{constraint}</p></div>)}
          </div>
        </div>
      </section>

      <section id="decisions" className={styles.section}>
        <SectionLabel>02 / Key decisions</SectionLabel><h2>Tradeoffs made explicit</h2>
        <div className={styles.decisions}>
          {project.decisions?.map((decision, index) => (
            <div key={decision.title}><span className={styles.decisionIndex}>0{index + 1}</span><h3>{decision.title}</h3><p>{decision.detail}</p></div>
          ))}
        </div>
      </section>

      <section id="engineering" className={styles.engineeringBand}>
        <div className={styles.section}>
          <SectionLabel>03 / Under the surface</SectionLabel>
          <div className={styles.engineeringGrid}>
            <EvidenceList title="Architecture" items={project.architecture} icon="architecture" />
            <EvidenceList title="Validation" items={project.validation} icon="validation" />
          </div>
          <div className={styles.stack}><span>Built with</span><ul>{project.tech.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>

      <section id="result" className={`${styles.section} ${styles.result}`}>
        <SectionLabel>04 / Result</SectionLabel><p>{project.proof}</p>
        <a href={project.link} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={styles.primaryLink}>
          {project.linkLabel ?? 'Open project'}<ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </section>

      <footer className={styles.footer}>
        <Link href={`/work/${nextProject.slug}`} className={styles.nextProject}>
          <div>
            <span className={styles.eyebrow}>Next case study / {String((projectIndex + 1) % FEATURED_CASE_STUDIES.length + 1).padStart(2, '0')}</span>
            <h2>{nextProject.title}</h2><p>{nextProject.eyebrow}</p>
          </div>
          <ArrowRight className={styles.nextArrow} aria-hidden="true" />
        </Link>
        <div className={styles.footerBottom}>
          <Link href="/">Andy Sottiaux</Link><Link href="/#projects">All selected work <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      </footer>
    </main>
  )
}

function HeroVisual({ project }: { project: NonNullable<ReturnType<typeof getCaseStudy>> }) {
  if (project.heroMode === 'gallery' && project.heroGallery?.length) {
    return (
      <div className={styles.gallery}>
        {project.heroGallery.map((image, index) => (
          <div key={image} className={styles.phone}>
            <Image src={image} alt={`${project.title} product screen ${index + 1}`} fill priority={index === 0} sizes="(max-width: 640px) 36vw, (max-width: 1000px) 25vw, 230px" className={styles.screenImage} />
          </div>
        ))}
      </div>
    )
  }

  if (project.heroMode === 'system') {
    return (
      <div className={styles.systemVisual}>
        <div className={styles.systemHeader}><Radio size={18} aria-hidden="true" /><span>Field camera / architecture</span></div>
        <div className={styles.systemNodes}>
          {FIELD_SYSTEM_NODES.map((node, index) => (
            <div key={node} className={styles.systemNode}>
              <span className={styles.nodeNumber}>0{index + 1}</span><span>{node}</span>
              {index === FIELD_SYSTEM_NODES.length - 1 ? <ArrowUpRight size={20} aria-hidden="true" /> : <ArrowDown size={19} aria-hidden="true" />}
            </div>
          ))}
        </div>
        <p className={styles.systemFootnote}>One system. From the physical world to the browser.</p>
      </div>
    )
  }

  if (project.heroMode === 'epaper' && project.heroImage) {
    return <EpaperProductViewer dashboardSrc={project.heroImage} dashboardAlt={project.heroImageAlt ?? ''} />
  }
  if (!project.heroImage) return <div className={styles.emptyVisual} />

  return (
    <div className={project.heroMode === 'contain' ? styles.containedVisual : styles.coverVisual}>
      <Image src={project.heroImage} alt={project.heroImageAlt ?? ''} fill priority sizes="(max-width: 1000px) 92vw, 55vw" className={project.heroMode === 'contain' ? styles.containedImage : styles.coverImage} />
    </div>
  )
}

function CapabilityTour({ tour }: { tour: NonNullable<NonNullable<ReturnType<typeof getCaseStudy>>['tour']> }) {
  const markerColors = {
    red: 'border-[#c21c25] bg-[#c21c25] text-white',
    yellow: 'border-[#f4c20d] bg-[#f4c20d] text-[#17130a]',
    black: 'border-[#17191d] bg-[#17191d] text-white',
  }

  return (
    <section id="capability-tour" className={styles.tour}>
      <div className={styles.section}>
        <div className={styles.tourHeading}>
          <div><div className={styles.tourLabel}>Interface tour</div><h2>{tour.title}</h2></div><p>{tour.intro}</p>
        </div>
        <div className={styles.tourDisplay}>
          <div className={styles.tourDisplayCaption}><span>Native dashboard canvas</span><span>1360 × 480 · four-color e-paper</span></div>
          <div className="relative aspect-[17/6] overflow-hidden rounded-[3px] bg-white">
            <Image src={tour.image} alt={tour.imageAlt} fill sizes="(max-width: 1280px) 94vw, 1232px" className="object-contain" />
            {tour.stops.map((stop, index) => stop.marker ? (
              <div key={stop.title} aria-hidden="true" className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.35)] sm:h-9 sm:w-9 sm:text-xs ${markerColors[stop.accent ?? 'black']}`} style={{ left: `${stop.marker.x}%`, top: `${stop.marker.y}%` }}>{index + 1}</div>
            ) : null)}
          </div>
        </div>
        <ol className={styles.tourStops}>
          {tour.stops.map((stop, index) => (
            <li key={stop.title}>
              <div className={styles.stopHeading}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${markerColors[stop.accent ?? 'black']}`}>{index + 1}</span><h3>{stop.title}</h3>
              </div>
              <p>{stop.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={styles.sectionLabel}>{children}</p>
}

function EvidenceList({ title, items, icon }: { title: string; items: string[]; icon: 'architecture' | 'validation' }) {
  const Icon = icon === 'validation' ? CheckCircle2 : CircleDot
  return (
    <div className={styles.evidence}>
      <h2>{title}</h2>
      <ul>{items.map((item) => <li key={item}><Icon size={17} aria-hidden="true" /><span>{item}</span></li>)}</ul>
    </div>
  )
}
