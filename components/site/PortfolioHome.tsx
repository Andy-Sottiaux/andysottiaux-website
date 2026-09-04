import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUpRight, AudioLines, Cpu, Radio, Route } from 'lucide-react'
import { EXPERIENCE_ITEMS } from '@/components/portfolio/content'
import SystemExplorer from './SystemExplorer'
import SiteNavigation from './SiteNavigation'
import styles from './portfolio.module.css'

const email = 'mailto:andrewsottiaux@gmail.com'

export default function PortfolioHome() {
  return (
    <div className={styles.site}>
      <SiteNavigation home />
      <main id="main-content">
        <section className={`${styles.hero} ${styles.container}`} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.smallCross}>+</span> ENGINEER. FOUNDER. ALWAYS BUILDING.</p>
            <h1 id="hero-title">I build across<br/>the <em>boundaries.</em></h1>
            <p className={styles.heroIntro}>From aircraft hardware to the software in your pocket. I’m Andy—a Dallas-based engineer connecting the physical and digital worlds.</p>
            <div className={styles.heroActions}><a href="#projects" className={styles.primaryButton}>Explore my work<ArrowDown size={16} aria-hidden="true"/></a><a href="#about" className={styles.textLink}>A little about me<ArrowUpRight size={15} aria-hidden="true"/></a></div>
            <div className={styles.heroCredential}><Image src="/images/andy-casual-headshot-2026.webp" alt="Andy Sottiaux" width={42} height={42} priority/><div><span>Senior Engineer at AVX Aircraft</span><span>Founder of HatchingPoint</span></div></div>
          </div>
          <SystemExplorer />
        </section>

        <div className={`${styles.disciplineStrip} ${styles.container}`}><span>A PRACTICE THAT CONNECTS</span><div><span>Aerospace</span><i aria-hidden="true">/</i><span>Embedded systems</span><i aria-hidden="true">/</i><span>Robotics</span><i aria-hidden="true">/</i><span>Digital products</span></div><span className={styles.stripIndex}>01 — 04</span></div>

        <section id="projects" className={`${styles.projects} ${styles.container}`} aria-labelledby="projects-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / SELECTED WORK</p><h2 id="projects-title">Ideas are good.<br/><em>Built is better.</em></h2></div><p>Independent builds and shipped products.<br className={styles.desktopBreak}/> The decisions, details, and evidence behind them.</p></div>

          <article className={styles.featuredProject}>
            <Link prefetch={false} href="/work/epaper-dashboard" className={styles.epaperVisual} aria-label="Explore Runner’s E-Paper Dashboard"><div className={styles.visualTag}>PHYSICAL PRODUCT / 001</div><Image src="/images/epaper-dashboard-studio.webp" alt="Visualization of the runner’s four-color e-paper dashboard" fill sizes="(max-width: 800px) 92vw, 60vw" className={styles.epaperImage}/><span className={styles.visualBottom}>10.85 INCHES. FOUR COLORS. ONE USEFUL GLANCE.</span><span className={styles.imageArrow}><ArrowUpRight size={22} aria-hidden="true"/></span></Link>
            <div className={styles.featuredCopy}><p className={styles.projectCategory}>EMBEDDED SYSTEMS × PRODUCT DESIGN</p><h3>A quieter kind<br/>of dashboard.</h3><p>Training, weather, and the day ahead. An e-paper command center designed to give you what you need, then get out of the way.</p><div className={styles.projectInsight}><Cpu size={18} aria-hidden="true"/><span>One seamless interface.<br/>Two display controllers underneath.</span></div><Link prefetch={false} href="/work/epaper-dashboard" className={styles.projectLink}>Inside the build<ArrowUpRight size={17} aria-hidden="true"/></Link><div className={styles.projectTags}><span>Raspberry Pi</span><span>Custom driver</span><span>Interface design</span></div></div>
          </article>

          <div className={styles.projectPair}>
            <article className={styles.projectCard}>
              <Link prefetch={false} href="/work/travel-agent-ai" className={styles.travelVisual} aria-label="Explore Travel Agent AI"><div className={styles.visualTag}>SHIPPED SOFTWARE / 002</div><div className={styles.travelWordmark}><Image src="/images/travelagentai-icon.png" alt="" width={36} height={36}/><span>Travel Agent AI</span></div><div className={styles.phoneGallery}><div className={styles.phone}><Image src="/images/travel-review-native.webp" alt="Travel Agent AI native booking review with sample data" width={440} height={956} sizes="(max-width: 600px) 40vw, 216px"/></div><div className={styles.phone}><Image src="/images/travel-edit-native.webp" alt="Travel Agent AI native booking editor with sample data" width={440} height={956} sizes="(max-width: 600px) 40vw, 216px"/></div></div><span className={styles.imageArrow}><ArrowUpRight size={22} aria-hidden="true"/></span></Link>
              <div className={styles.projectCardCopy}><div className={styles.projectCategory}>AI × iOS × THE REAL WORLD</div><h3><Link prefetch={false} href="/work/travel-agent-ai">Less logistics.<br/>More being there.<ArrowUpRight size={25} aria-hidden="true"/></Link></h3><p>Turn scattered bookings into a shared, living itinerary. A production iOS app built around the way travel actually happens.</p><div className={styles.projectTags}><span>SwiftUI</span><span>AI booking capture</span><span>App Store</span></div></div>
            </article>
            <article className={styles.projectCard}>
              <Link prefetch={false} href="/work/wyzecar" className={styles.robotVisual} aria-label="Explore WYZECAR"><div className={styles.visualTag}>ROBOTICS EXPERIMENT / 003</div><span className={styles.robotCoordinate}>PERCEIVE → DECIDE → MOVE</span><div className={styles.robotGrid} aria-hidden="true"/><Image src="/images/wyzecar.png" alt="CAD rendering of the WYZECAR camera-equipped robot" fill sizes="(max-width: 800px) 90vw, 45vw" className={styles.robotImage}/><span className={styles.trackingCorner} aria-hidden="true"/><span className={styles.robotCaption}>VISION-TO-CONTROL TESTBED</span><span className={styles.imageArrow}><ArrowUpRight size={22} aria-hidden="true"/></span></Link>
              <div className={styles.projectCardCopy}><div className={styles.projectCategory}>COMPUTER VISION × ROBOTICS</div><h3><Link prefetch={false} href="/work/wyzecar">From pixels<br/>to movement.<ArrowUpRight size={25} aria-hidden="true"/></Link></h3><p>A camera, a small robot, and a complete autonomy loop. WYZECAR brings perception, browser control, and motion tuning into one testbed.</p><div className={styles.projectTags}><span>YOLOv8</span><span>ROS2</span><span>Public source</span></div></div>
            </article>
          </div>

          <div className={styles.moreWork}><div><AudioLines size={22} aria-hidden="true"/><span>Also in the App Store</span><a href="https://apps.apple.com/app/record-transcribe/id6758643630" target="_blank" rel="noopener noreferrer">Record + Transcribe<ArrowUpRight size={15} aria-hidden="true"/></a></div><a href="https://www.hatchingpoint.com/" target="_blank" rel="noopener noreferrer">More from HatchingPoint<ArrowUpRight size={16} aria-hidden="true"/></a></div>
        </section>

        <section className={styles.labSection} aria-labelledby="lab-title"><div className={`${styles.labInner} ${styles.container}`}>
          <div className={styles.labCopy}><p className={styles.eyebrow}>02 / BEYOND THE CASE STUDY</p><h2 id="lab-title">The work<br/><em>keeps running.</em></h2><p>A solar-powered field camera. On-device AI. Live system telemetry. Step inside the lab to see the hardware and software working together.</p><div className={styles.labActions}><Link href="/lab" prefetch={false} className={styles.primaryButton}>Enter the live lab<ArrowUpRight size={17} aria-hidden="true"/></Link><Link prefetch={false} href="/work/field-camera" className={styles.textLink}>Read the case study<ArrowRight size={15} aria-hidden="true"/></Link></div></div>
          <div className={styles.labSchematic}><div className={styles.labSchematicHeader}><span><Radio size={14} aria-hidden="true"/> FIELD SYSTEM / ARCHITECTURE</span><span>004</span></div><div className={styles.labNodes}><div><span className={styles.nodeNumber}>01</span><Radio size={26} aria-hidden="true"/><strong>Sense</strong><span>Edge camera</span></div><span className={styles.nodeConnector} aria-hidden="true"/><div><span className={styles.nodeNumber}>02</span><Cpu size={26} aria-hidden="true"/><strong>Understand</strong><span>On-device inference</span></div><span className={styles.nodeConnector} aria-hidden="true"/><div><span className={styles.nodeNumber}>03</span><Route size={26} aria-hidden="true"/><strong>Connect</strong><span>Secure relay</span></div></div><div className={styles.labSchematicFooter}><span>Solar power · Embedded Linux · WebRTC</span><Link href="/lab/dashboard" prefetch={false}>Compact dashboard<ArrowUpRight size={13} aria-hidden="true"/></Link></div></div>
        </div></section>

        <section id="about" className={`${styles.about} ${styles.container}`} aria-labelledby="about-title">
          <div className={styles.aboutIntro}><div className={styles.portraitFrame}><Image src="/images/andy-casual-headshot-2026.webp" alt="Andy Sottiaux, engineer and founder based in Dallas" width={864} height={864} sizes="(max-width: 650px) 90vw, 36vw"/><div><span>ANDY SOTTIAUX</span><span>DALLAS, TEXAS ↗</span></div></div><div className={styles.aboutCopy}><p className={styles.eyebrow}>03 / THE PERSON BEHIND THE PROJECTS</p><h2 id="about-title">Curiosity doesn’t<br/><em>stay in one lane.</em></h2><p>I’m an engineer and founder who likes understanding how the whole thing works—and then making it work better.</p><p>At AVX Aircraft, that means rotor systems, subscale UAVs, and early autonomy. At HatchingPoint, it means turning ideas into production iPhone apps. In between, you’ll find me building the hardware, interfaces, and tools I wish existed.</p><p>The thread through all of it: design thoughtfully, build with your hands, and test in the real world.</p><a href="https://www.linkedin.com/in/andy-sottiaux-593700100/" target="_blank" rel="noopener noreferrer" className={styles.textLink}>More of the backstory<ArrowUpRight size={16} aria-hidden="true"/></a><aside role="note" id="professional-context" className={styles.professionalContext}><h3>Professional experience. Independent proof.</h3><p>My aerospace work is collaborative and confidential. Employer-owned designs, program details, and performance data stay private. The detailed case studies here cover my independent projects and HatchingPoint products.</p></aside></div></div>
          <div className={styles.experience}><div><p className={styles.eyebrow}>THE PATH SO FAR</p><p>Different disciplines.<br/>One connected practice.</p></div><div className={styles.experienceRows}>{EXPERIENCE_ITEMS.map(item => <a key={item.company} href={item.url} target="_blank" rel="noopener noreferrer"><span>{item.company}</span><span>{item.title}</span><span>{item.period}</span><ArrowUpRight size={16} aria-hidden="true"/></a>)}</div></div>
          <aside className={styles.running}><span className={styles.runningDistance}>26.2</span><div><p className={styles.eyebrow}>OFF THE CLOCK / ON THE ROAD</p><h3>Building endurance, too.</h3><p>Running the 2026 New York City Marathon for Team for Kids. A different kind of long-term project.</p></div><a href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8" target="_blank" rel="noopener noreferrer" className={styles.textLink}>Support the miles<ArrowUpRight size={17} aria-hidden="true"/></a></aside>
        </section>

        <section id="contact" className={styles.contact} aria-labelledby="contact-title"><div className={styles.container}><p className={styles.eyebrow}>04 / A GOOD CONVERSATION IS A START</p><div className={styles.contactHeading}><h2 id="contact-title">What could we<br/><em>build together?</em></h2><a href={email} className={styles.contactArrow} aria-label="Email Andy"><ArrowUpRight aria-hidden="true"/></a></div><div className={styles.contactBottom}><a href={email}>andrewsottiaux@gmail.com</a><p>Aerospace, embedded systems, and useful software. Let’s compare notes.</p></div></div></section>
      </main>
      <footer className={`${styles.footer} ${styles.container}`}><span>© {new Date().getFullYear()} Andy Sottiaux</span><span className={styles.footerNote}>MADE WITH INTENTION. ALWAYS IN PROGRESS.</span><div><a href="https://github.com/Andy-Sottiaux" target="_blank" rel="noopener noreferrer">GitHub<ArrowUpRight size={13} aria-hidden="true"/></a><a href="https://www.linkedin.com/in/andy-sottiaux-593700100/" target="_blank" rel="noopener noreferrer">LinkedIn<ArrowUpRight size={13} aria-hidden="true"/></a><a href="#main-content">Back to top ↑</a></div></footer>
    </div>
  )
}
