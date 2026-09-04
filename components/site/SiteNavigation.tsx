import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import styles from './portfolio.module.css'

export default function SiteNavigation() {
  return (
    <header className={styles.header}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.wordmark} aria-label="Andy Sottiaux home"><svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M3 23 14 4l11 19M8 16h12M14 4v19" stroke="currentColor" strokeWidth="1.5"/></svg><span>Andy Sottiaux<span className={styles.wordmarkDot}>.</span></span></Link>
        <nav aria-label="Main navigation" className={styles.navLinks}>
          <a href="#projects">Selected work</a><a href="#about">About</a><Link href="/lab" prefetch={false}>Live lab<span className={styles.navLabDot} aria-hidden="true"/></Link><a href="#contact" className={styles.navContact}>Let’s talk<ArrowUpRight size={14} aria-hidden="true"/></a>
        </nav>
      </div>
    </header>
  )
}
