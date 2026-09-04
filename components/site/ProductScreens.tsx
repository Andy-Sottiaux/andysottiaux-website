'use client'

import Image from 'next/image'
import { useId, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import styles from './screens.module.css'

type Screen = { title: string; detail: string; image: string; alt: string }

export default function ProductScreens({ screens }: { screens: Screen[] }) {
  const [active, setActive] = useState(0)
  const id = useId()
  const screen = screens[active]
  return (
    <section className={styles.story} aria-labelledby={`${id}-title`}>
      <div className={styles.intro}><p className={styles.kicker}>A CLOSER LOOK AT BOOKING IMPORT</p><h2 id={`${id}-title`}>The important step<br/>is the review.</h2><p>Extracted information should be easy to question and correct. These are the app’s native review and editing views, rendered with sample booking data.</p>
        <div className={styles.steps} role="group" aria-label="Inspect native booking views">{screens.map((item, index) => <button type="button" key={item.title} aria-pressed={active === index} aria-controls={`${id}-screen`} data-portfolio-event="walkthrough" onClick={() => setActive(index)}><span>0{index + 1}</span><span>{item.title}</span><ArrowUpRight size={18} aria-hidden="true"/></button>)}</div>
        <div className={styles.detail} aria-live="polite" aria-atomic="true"><h3>{screen.title}</h3><p>{screen.detail}</p></div><p className={styles.note}>Native-view captures · sample data.<br/>An isolated preview is used; saving and network access are disabled. These images are not a live AI demo.</p>
      </div>
      <figure className={styles.capture} id={`${id}-screen`}><a href={screen.image} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size capture: ${screen.title}`}><div className={styles.image}><Image src={screen.image} alt={screen.alt} fill sizes="(max-width: 650px) 85vw, 410px" className={styles.nativeImage}/></div></a><figcaption><span>Native SwiftUI / sample booking</span><a href={screen.image} target="_blank" rel="noopener noreferrer">View full size<ArrowUpRight size={14} aria-hidden="true"/></a></figcaption></figure>
    </section>
  )
}
