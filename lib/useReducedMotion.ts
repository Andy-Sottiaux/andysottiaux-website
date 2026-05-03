'use client'

import { useEffect, useState } from 'react'

/**
 * Reports `prefers-reduced-motion: reduce` from the OS. Defaults to `false`
 * during SSR / first paint so the page hydrates without an animation flicker
 * for the (much larger) cohort that does want motion.
 *
 * Components should branch off this for any *custom* JS animation
 * (IntersectionObserver-driven reveals, ticker/marquee loops, decorative
 * pings). Plain CSS transitions on hover/focus can be left alone — modern
 * browsers already collapse them via the global rule in `globals.css`.
 */
export function useReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setPrefers(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return prefers
}
