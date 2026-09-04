'use client'

import { track } from '@vercel/analytics'
import { useEffect } from 'react'

/** Only allow-listed interaction names. Never collect text, emails, or query strings. */
export default function PortfolioAnalytics() {
  useEffect(() => {
    // Vercel custom events require an eligible plan. Never send unsupported
    // events on Hobby, and never upgrade billing as part of a site release.
    if (process.env.NEXT_PUBLIC_PORTFOLIO_EVENTS !== '1') return
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const control = event.target.closest<HTMLAnchorElement | HTMLButtonElement>('a, button')
      if (!control) return
      const href = control.getAttribute('href') ?? ''
      const path = window.location.pathname
      if (!['/', '/lab', '/work/epaper-dashboard', '/work/travel-agent-ai', '/work/field-camera', '/work/wyzecar'].includes(path)) return
      let name: string | undefined
      let destination: string | undefined
      if (/^\/work\/(epaper-dashboard|travel-agent-ai|field-camera|wyzecar)$/.test(href)) {
        name = 'Project opened'
        destination = href.split('/').pop()
      } else if (href === 'mailto:andrewsottiaux@gmail.com') {
        name = 'Contact selected'
      } else if (href === '/lab') {
        name = 'Lab opened'
      } else if (control.dataset.portfolioEvent === 'walkthrough') {
        name = 'Walkthrough explored'
      } else if (control.dataset.portfolioEvent === 'product') {
        name = 'Product opened'
      }
      if (!name || navigator.doNotTrack === '1') return
      try {
        track(name, { page: path, ...(destination ? { project: destination } : {}) })
      } catch {
        // Blocked analytics must never affect navigation or controls.
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])
  return null
}
