import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import styles from './portfolio.module.css'

export default function SiteNavigation({ home = false }: { home?: boolean }) {
  const section = (id: string) => `${home ? '' : '/'}#${id}`
  return (
    <header className={styles.header} data-site-navigation>
      <div className={styles.navInner}>
        <Link href="/" className={styles.wordmark} aria-label="Andy Sottiaux home"><svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M3 23 14 4l11 19M8 16h12M14 4v19" stroke="currentColor" strokeWidth="1.5"/></svg><span>Andy Sottiaux<span className={styles.wordmarkDot}>.</span></span></Link>
        <nav aria-label="Main navigation" className={styles.navLinks}>
          <Link href={section('projects')} prefetch={false}>Selected work</Link><Link href={section('about')} prefetch={false}>About</Link><Link href="/lab" prefetch={false}>Live lab</Link><Link href={section('contact')} prefetch={false} className={styles.navContact}>Let’s talk<ArrowUpRight size={14} aria-hidden="true"/></Link>
        </nav>
      </div>
    </header>
  )
}
