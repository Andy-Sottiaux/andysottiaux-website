import { ArrowUpRight } from 'lucide-react'
import { PROJECT_EVIDENCE } from '@/content/projectEvidence'
import styles from './evidence.module.css'

export default function ProjectEvidence({ slug }: { slug: string }) {
  const evidence = PROJECT_EVIDENCE[slug]
  if (!evidence) return null
  return (
    <section className={styles.record} aria-labelledby="evidence-title">
      <div className={styles.heading}><div><p className={styles.kicker}>EVIDENCE & BOUNDARIES</p><h2 id="evidence-title">What this work demonstrates.</h2></div><div className={styles.stamp}><span>{evidence.basis}</span><time dateTime={evidence.reviewed}>Reviewed September 4, 2026</time></div></div>
      <div className={styles.result}><span className={styles.status}>{evidence.status}</span><p>{evidence.result}</p></div>
      <div className={styles.tradeoff}><h3>{evidence.tradeoff.question}</h3><dl><div><dt>Decision</dt><dd>{evidence.tradeoff.choice}</dd></div><div><dt>Tradeoff</dt><dd>{evidence.tradeoff.cost}</dd></div></dl></div>
      <div className={styles.limit}><h3>Scope & limitations</h3><p>{evidence.limitation}</p></div>
      {evidence.sources.length > 0 && <ul className={styles.sources}>{evidence.sources.map(source => <li key={source.url}><a href={source.url} target={source.url.startsWith('https:') ? '_blank' : undefined} rel={source.url.startsWith('https:') ? 'noopener noreferrer' : undefined}>{source.title}<ArrowUpRight size={18} aria-hidden="true"/></a><p>{source.detail}</p></li>)}</ul>}
    </section>
  )
}
