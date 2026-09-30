'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import styles from './AmoledProductViewer.module.css'

const WIDGETS = [
  { id: 'clock', name: 'Clock', color: '#79d6ff', description: 'Large, clear time with the date and AM/PM.' },
  { id: 'weather', name: 'Weather', color: '#ffd46b', description: 'Location, temperature, and the details for your day.' },
  { id: 'runna', name: 'Runna', color: '#99ff77', description: 'The next workout, mileage, and a weekly target.' },
  { id: 'training', name: 'Training', color: '#ff713e', description: 'Strava mileage and run totals in a single glance.' },
  { id: 'nyc-marathon', name: 'NYC Marathon', color: '#47d6f3', description: 'A race countdown and Team for Kids fundraising progress.' },
  { id: 'time-progress', name: 'Time progress', color: '#6bf2cd', description: 'Today’s progress, with month and year context.' },
  { id: 'claude-usage', name: 'Claude usage', color: '#f1aa8c', description: 'Two usage windows, with explicit data freshness.' },
] as const

type AmoledProductViewerProps = {
  variant?: 'compact' | 'full'
  active?: boolean
  className?: string
}

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

const getDocumentVisibility = () => document.visibilityState === 'visible'
const getServerVisibility = () => true

/** Public, static examples of the actual firmware renderer. No device API is read. */
export default function AmoledProductViewer({
  variant = 'full',
  active = true,
  className = '',
}: AmoledProductViewerProps) {
  const [index, setIndex] = useState(2)
  const [playing, setPlaying] = useState(false)
  const documentVisible = useSyncExternalStore(subscribeToVisibility, getDocumentVisibility, getServerVisibility)
  const [inView, setInView] = useState(true)
  const hostRef = useRef<HTMLElement>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const reducedMotion = useReducedMotion()
  const widget = WIDGETS[index]

  useEffect(() => {
    const host = hostRef.current
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 },
    )
    if (host) observer?.observe(host)
    return () => {
      observer?.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!playing || !active || !documentVisible || !inView || reducedMotion) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % WIDGETS.length), 8000)
    return () => window.clearInterval(timer)
  }, [active, documentVisible, inView, playing, reducedMotion])

  const select = (next: number) => {
    if (!active) return
    setPlaying(false)
    setIndex((next + WIDGETS.length) % WIDGETS.length)
  }

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active) return
    const next = event.key === 'ArrowRight' ? index + 1
      : event.key === 'ArrowLeft' ? index - 1
        : event.key === 'Home' ? 0
          : event.key === 'End' ? WIDGETS.length - 1
            : null
    if (next === null) return
    event.preventDefault()
    event.stopPropagation()
    select(next)
  }

  const startSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if (!active) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  const finishSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || !active) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      event.stopPropagation()
      select(index + (dx < 0 ? 1 : -1))
    }
  }

  const tabIndex = active ? undefined : -1

  return (
    <section
      ref={hostRef}
      aria-label="AMOLED widget preview"
      aria-roledescription="carousel"
      data-amoled-product-viewer="true"
      data-amoled-widget={widget.id}
      data-amoled-variant={variant}
      className={`${styles.viewer} ${variant === 'compact' ? styles.compact : styles.full} ${className}`}
      style={{ '--amoled-accent': widget.color } as CSSProperties}
      onFocusCapture={() => setPlaying(false)}
    >
      <div aria-hidden="true" className={styles.halo} />
      <figure className={styles.figure}>
        <div className={styles.productStage}>
          <div aria-hidden="true" className={styles.groundShadow} />
          <div
            data-amoled-device="true"
            className={styles.device}
            onPointerDown={startSwipe}
            onPointerUp={finishSwipe}
            onPointerCancel={() => { pointerStart.current = null }}
          >
            <div className={styles.screen}>
              <Image
                src={`/images/amoled/${widget.id}.webp`}
                alt={`${widget.name} widget rendered by the native LVGL firmware, using example data`}
                width={480}
                height={480}
                sizes={variant === 'compact' ? '(max-width: 640px) 38vw, 220px' : '(max-width: 540px) 180px, 320px'}
                className={styles.frame}
                draggable={false}
              />
              <div aria-hidden="true" className={styles.glassEdge} />
            </div>
            <span aria-hidden="true" className={styles.port} />
          </div>
        </div>
        <figcaption className={styles.caption}>Native LVGL renders · example data</figcaption>
      </figure>

      <div className={styles.story}>
        <div className={styles.widgetCopy} aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
          <p className={styles.counter}>{index + 1} / {WIDGETS.length} widgets</p>
          <p className={styles.widgetTitle}>{widget.name}</p>
          <p className={styles.description}>{widget.description}</p>
        </div>
        <div role="group" aria-label="AMOLED widget controls" onKeyDown={navigate} className={styles.controls}>
          <div className={styles.selectors}>
            {WIDGETS.map((item, position) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ${item.name} AMOLED widget`}
                aria-pressed={position === index}
                title={item.name}
                disabled={!active}
                tabIndex={tabIndex}
                onClick={(event) => {
                  event.stopPropagation()
                  select(position)
                }}
                className={styles.selector}
                style={{ '--widget-color': item.color } as CSSProperties}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className={styles.transport}>
            <button type="button" aria-label="Previous AMOLED widget" disabled={!active} tabIndex={tabIndex} onClick={(event) => { event.stopPropagation(); select(index - 1) }}>
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
            <button
              type="button"
              aria-label={playing && !reducedMotion ? 'Pause AMOLED carousel' : 'Play AMOLED carousel'}
              aria-pressed={playing && !reducedMotion}
              disabled={!active || reducedMotion}
              tabIndex={tabIndex}
              title={reducedMotion ? 'Automatic rotation is disabled by your reduced-motion preference' : undefined}
              onClick={(event) => { event.stopPropagation(); setPlaying(!playing) }}
            >
              {playing && !reducedMotion ? <Pause aria-hidden="true" size={13} /> : <Play aria-hidden="true" size={13} />}
            </button>
            <button type="button" aria-label="Next AMOLED widget" disabled={!active} tabIndex={tabIndex} onClick={(event) => { event.stopPropagation(); select(index + 1) }}>
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        <p className={styles.visualization}>Display visualization</p>
      </div>
    </section>
  )
}
