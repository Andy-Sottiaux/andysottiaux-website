'use client'

import { useId, useState } from 'react'
import { ArrowRight, Camera, Cpu, ShieldCheck, Radio } from 'lucide-react'
import styles from './showcase.module.css'

const steps = [
  { name: 'Capture', icon: Camera, title: 'Start at the edge.', detail: 'The field camera supplies frames to the local Linux system. A frame and an inference result are separate signals: having a picture does not prove the model is running.', signal: 'Camera → local processing', boundary: 'Camera media stays access-controlled.' },
  { name: 'Understand', icon: Cpu, title: 'Keep inference close to the sensor.', detail: 'On-device inference turns camera frames into detections. Model state, result freshness, and processing latency need their own health checks—not just a connected indicator.', signal: 'Local processing → detections', boundary: 'A detection is a model output, not a confirmed event.' },
  { name: 'Relay', icon: ShieldCheck, title: 'Separate public visibility from private access.', detail: 'The website requests data through a server-side relay. Camera playback requires access; device credentials are never part of the public interface.', signal: 'Protected relay → website', boundary: 'Exploring this guide never starts a camera stream.' },
  { name: 'Observe', icon: Radio, title: 'Make failure understandable.', detail: 'Power, service health, and camera transport can fail independently. The live dashboard distinguishes a fresh reading, an older retained reading, and an unavailable source.', signal: 'Telemetry → an informed operator', boundary: 'Live data appears only in the operational dashboard below.' },
]

export default function LabWalkthrough() {
  const [active, setActive] = useState(0)
  const id = useId()
  const step = steps[active]
  return (
    <section className={styles.walkthrough} aria-labelledby={`${id}-title`}>
      <div className={styles.walkthroughHeading}><div><p className={styles.kicker}>PUBLIC SYSTEM GUIDE</p><h2 id={`${id}-title`}>From a frame to a useful signal.</h2></div><span className={styles.label}>Interactive explanation · not live data</span></div>
      <div className={styles.stepButtons} role="group" aria-label="Explore the field system">
        {steps.map((item, index) => <button key={item.name} type="button" aria-pressed={active === index} aria-controls={`${id}-panel`} data-portfolio-event="walkthrough" onClick={() => setActive(index)}><item.icon size={21} aria-hidden="true"/><span><small>0{index + 1}</small>{item.name}</span><ArrowRight size={16} aria-hidden="true"/></button>)}
      </div>
      <div className={styles.labExplanation} id={`${id}-panel`} aria-live="polite" aria-atomic="true">
        <div><p className={styles.signal}>{step.signal}</p><h3>{step.title}</h3><p>{step.detail}</p></div><div className={styles.accessNote}><ShieldCheck size={24} aria-hidden="true"/><p>{step.boundary}</p></div>
      </div>
      <div className={styles.stateLegend} aria-label="How to read the operational dashboard">
        <p><strong><i className={styles.freshDot}/>Fresh</strong>Recent data from the source.</p>
        <p><strong><i className={styles.staleDot}/>Stale</strong>A retained reading; check its age.</p>
        <p><strong><i className={styles.offlineDot}/>Unavailable</strong>No current reading. Never interpreted as zero.</p>
      </div>
    </section>
  )
}
