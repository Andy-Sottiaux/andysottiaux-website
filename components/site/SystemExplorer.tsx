'use client'

import { useId, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import styles from './portfolio.module.css'

const LAYERS = [
  { name: 'Mechanical', label: 'Give an idea physical form.', detail: 'Rotor systems, CAD, and hardware built for the real world.', link: '/#professional-context', cta: 'The professional context', number: '01' },
  { name: 'Embedded', label: 'Make the physical intelligent.', detail: 'Custom display drivers, edge perception, and the software inside the system.', link: '/work/epaper-dashboard', cta: 'Explore an embedded system', number: '02' },
  { name: 'Software', label: 'Bring it into people’s hands.', detail: 'Thoughtful interfaces and production apps that connect the whole experience.', link: '/work/travel-agent-ai', cta: 'Explore a shipped product', number: '03' },
] as const

export default function SystemExplorer() {
  const [active, setActive] = useState(1)
  const id = useId()
  const layer = LAYERS[active]

  return (
    <div className={styles.explorer}>
      <div className={styles.diagramCaption}><span>ANATOMY OF A BUILDER</span><span>FIG. 01 / INTERACTIVE</span></div>
      <div className={styles.diagramWrap}>
        <svg viewBox="0 0 540 430" className={styles.systemDrawing} aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-plane`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#303b33"/><stop offset="1" stopColor="#17201b"/></linearGradient>
            <radialGradient id={`${id}-glow`}><stop stopColor="#f49a6c" stopOpacity=".15"/><stop offset="1" stopColor="#f49a6c" stopOpacity="0"/></radialGradient>
          </defs>
          <circle cx="276" cy="214" r="188" fill={`url(#${id}-glow)`}/>
          <g fill="none" stroke="#727d70" strokeWidth=".7" opacity=".24">
            <ellipse cx="268" cy="322" rx="224" ry="89"/>
            <ellipse cx="268" cy="322" rx="188" ry="72"/>
            <path d="M24 322h490M268 218v198M91 263l354 118M91 381l354-118"/>
          </g>
          <g stroke="#7c887a" strokeWidth=".8" strokeDasharray="3 6" opacity=".55"><path d="M102 159v132M268 77v135M434 159v132M268 241v132"/></g>
          {[0, 1, 2].map((index) => {
            const y = 120 - index * 61
            const selected = active === index
            return (
              <g key={index} className={styles.systemLayer} style={{ opacity: selected ? 1 : .58 }}>
                <path d={`M102 ${159 + y} 268 ${77 + y} 434 ${159 + y} 268 ${241 + y}Z`} fill={`url(#${id}-plane)`} stroke={selected ? '#f49a6c' : '#727d70'} strokeWidth={selected ? 1.6 : .8}/>
                <path d={`M102 ${159 + y}v9l166 82 166-82v-9M268 ${241 + y}v9`} fill="none" stroke={selected ? '#b27655' : '#4a564b'} strokeWidth=".8"/>
                {index === 0 && <g fill="none" stroke={selected ? '#efb493' : '#899887'} strokeWidth="1"><ellipse cx="268" cy={159+y} rx="77" ry="37"/><ellipse cx="268" cy={159+y} rx="39" ry="19"/><path d={`M182 ${159+y}h172M268 ${116+y}v86M219 ${131+y}l98 56M219 ${187+y}l98-56`}/><circle cx="268" cy={159+y} r="5"/></g>}
                {index === 1 && <g fill="none" stroke={selected ? '#efb493' : '#899887'} strokeWidth="1"><path d={`M226 ${159+y}l42-21 42 21-42 21Z M209 ${159+y}l59-30 59 30-59 30Z M182 ${159+y}h27M327 ${159+y}h27M268 ${129+y}v-20M268 ${189+y}v20 M227 ${138+y}l-24-12M309 ${180+y}l24 12M309 ${138+y}l24-12M227 ${180+y}l-24 12`}/><circle cx="182" cy={159+y} r="3"/><circle cx="354" cy={159+y} r="3"/></g>}
                {index === 2 && <g fill="none" stroke={selected ? '#efb493' : '#899887'} strokeWidth="1"><path d={`M203 ${150+y}l59-29 75 37-59 29Z M217 ${156+y}l59-29 M234 ${154+y}l21-10 25 12-21 10Z M270 ${173+y}l12-6 M289 ${164+y}l24-12 M277 ${157+y}l24-12`}/><circle cx="220" cy={150+y} r="1"/></g>}
                <path d={`M434 ${159+y}h28`} stroke={selected ? '#f49a6c' : '#596656'} strokeWidth=".8"/>
                <text x="472" y={163+y} fill={selected ? '#f5ba98' : '#899887'} fontSize="10" fontFamily="monospace">0{index + 1}</text>
              </g>
            )
          })}
          <path d="M268 69v237" stroke="#f49a6c" strokeWidth="1" strokeDasharray="2 7" opacity=".7"/>
          <circle cx="268" cy="99" r="5" fill="#f49a6c"/>
          <circle cx="268" cy="99" r="12" fill="none" stroke="#f49a6c" opacity=".3" className={styles.signalRing}/>
          <g fill="#889282" fontFamily="monospace" fontSize="8"><text x="37" y="409">CONCEPT</text><text x="450" y="409">REALITY</text></g>
          <path d="M99 406h333m-5-3 5 3-5 3" stroke="#778570" strokeWidth=".6"/>
        </svg>
      </div>
      <fieldset className={styles.layerButtons}>
        <legend className="sr-only">Explore engineering disciplines</legend>
        {LAYERS.map((item, index) => <button key={item.name} type="button" aria-pressed={active === index} aria-controls={`${id}-detail`} onClick={() => setActive(index)}><span aria-hidden="true">{item.number}</span>{item.name}</button>)}
      </fieldset>
      <section className={styles.layerDetail} id={`${id}-detail`} aria-label="System layer details" aria-live="polite" aria-atomic="true">
        <p>{layer.label}</p><span>{layer.detail}</span>
        <Link href={layer.link} prefetch={false}>{layer.cta}<ArrowUpRight size={14} aria-hidden="true"/></Link>
      </section>
    </div>
  )
}
