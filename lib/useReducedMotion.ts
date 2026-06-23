'use client'

import { useSyncExternalStore } from 'react'

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
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => undefined
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => {
      if (typeof window === 'undefined') return false
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    },
    () => false,
  )
}
