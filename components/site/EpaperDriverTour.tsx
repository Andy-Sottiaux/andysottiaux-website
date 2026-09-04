'use client'

import { useId, useState } from 'react'
import styles from './showcase.module.css'

const operations = [
  { name: 'Left-side update', region: 'left', title: 'One changed region. One controller.', detail: 'A widget inside the left half can be sent to the master controller without treating the full canvas as dirty. Drawing and clipping must stay inside that controller’s address space.', command: 'Region inside x=0–679 → master controller' },
  { name: 'Right-side update', region: 'right', title: 'Same canvas, different local coordinates.', detail: 'The right half belongs to the slave controller. Global screen coordinates must be translated into its local window before a partial update is sent.', command: 'Region inside x=680–1359 → slave controller' },
  { name: 'Across the seam', region: 'both', title: 'A visual boundary is a hardware boundary.', detail: 'A region that crosses x=680 spans two controllers. It has to be clipped and mapped for both halves. The interface places frequently updated widgets within controller-safe zones.', command: 'Cross-seam region → two clipped controller windows' },
]

export default function EpaperDriverTour() {
  const [active, setActive] = useState(0)
  const id = useId()
  const operation = operations[active]
  return (
    <section className={styles.walkthrough} aria-labelledby={`${id}-title`}>
      <div className={styles.walkthroughHeading}><div><p className={styles.kicker}>INTERACTIVE ENGINEERING NOTE</p><h2 id={`${id}-title`}>One display. Two address spaces.</h2></div><span className={styles.label}>Driver explanation · not a hardware recording</span></div>
      <div className={styles.driverGrid}>
        <div>
          <div className={styles.panelDiagram} data-region={operation.region} role="img" aria-label={`1360 by 480 display split at x equals 680. ${operation.name}.`}>
            <div><span>MASTER</span><strong>680 × 480</strong><small>x=0–679</small></div><div><span>SLAVE</span><strong>680 × 480</strong><small>x=680–1359</small></div><span className={styles.refreshRegion}/>
          </div>
          <p className={styles.diagramNote}>1360 × 480 canvas <span>Controller seam at x=680</span></p>
          <div className={styles.segmentButtons} role="group" aria-label="Explore display updates">{operations.map((item, index) => <button key={item.name} type="button" aria-pressed={active === index} aria-controls={`${id}-detail`} data-portfolio-event="walkthrough" onClick={() => setActive(index)}>{item.name}</button>)}</div>
        </div>
        <div className={styles.driverDetail} id={`${id}-detail`} aria-live="polite" aria-atomic="true"><h3>{operation.title}</h3><p>{operation.detail}</p><code>{operation.command}</code><p className={styles.note}>The highlight illustrates addressing only. It does not simulate the panel’s physical color waveform or refresh speed.</p></div>
      </div>
    </section>
  )
}
