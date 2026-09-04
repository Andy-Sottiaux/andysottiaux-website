'use client'

import Link from 'next/link'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import LiveSystemDashboard from './LiveSystemDashboard'
import { FieldThemeProvider } from '../fieldTheme'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import SiteNavigation from '../site/SiteNavigation'
import LabWalkthrough from '../site/LabWalkthrough'
import styles from './lab.module.css'

export default function LiveLabPage() {
  const [selectedCamera, setSelectedCamera] = useState<FieldCameraSource>('field')
  return (
    <FieldThemeProvider portfolio>
      <div className={styles.page}>
        <SiteNavigation />
        <main id="main-content" className={styles.container}>
          <header className={styles.intro}>
            <div><p className={styles.kicker}>ENGINEERING IN OPERATION</p><h1>Field systems and<br/>operational telemetry</h1><p className={styles.description}>A solar-powered camera, on-device inference, and a protected path to the browser. Explore the architecture, then inspect the system’s current state.</p></div>
            <div className={styles.actions}><a href="#live-dashboard">Inspect live status<ArrowDown size={17} aria-hidden="true"/></a><Link href="/work/field-camera">Read the case study<ArrowUpRight size={17} aria-hidden="true"/></Link></div>
          </header>
          <LabWalkthrough />
          <section id="live-dashboard" className={styles.dashboard} aria-labelledby="live-title">
            <div className={styles.dashboardHeading}><div><p className={styles.kicker}>CONNECTED HARDWARE</p><h2 id="live-title">The operational view.</h2><p>Each reading reports its own availability. Camera media requires access; the guide above does not.</p></div><Link href="/lab/dashboard">Compact dashboard<ArrowUpRight size={16} aria-hidden="true"/></Link></div>
            <LiveSystemDashboard selectedCamera={selectedCamera} onCameraChange={setSelectedCamera} showCaseStudyLink />
          </section>
          <footer className={styles.footer}><Link href="/">← Back to portfolio</Link><a href="mailto:andrewsottiaux@gmail.com">Discuss the engineering<ArrowUpRight size={16} aria-hidden="true"/></a></footer>
        </main>
      </div>
    </FieldThemeProvider>
  )
}
