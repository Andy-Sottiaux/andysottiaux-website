'use client'

/**
 * cayleyTheme — palette for the home-page Cayley section, theme-aware.
 *
 * The CurrentProject section + its three child cards (Solar, Camera, Health)
 * share a cinematic visual language. In dark mode it's the original
 * navy-to-near-black gradient with white-glass cards. In light mode it's a
 * calm bone-on-cream Apple-product-page treatment with white-glass cards on
 * a warm gradient.
 *
 * Live-data accent colors (cyan/emerald/amber) stay constant across themes —
 * they're the visual hooks that say "this number is alive right now."
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

type CayleyPalette = {
  mode: 'light' | 'dark'

  // Section-level
  sectionBackground: string

  // Card chrome
  cardBackground: string
  cardBorder: string
  cardShadow: string

  // Headline / body / muted
  headlineGradient: string
  bodyText: string
  mutedText: string
  fadedText: string

  // Subtle UI fill (for SOC bar troughs, sparkline baselines, etc.)
  trackBackground: string
  hairline: string
}

const DARK_PALETTE: CayleyPalette = {
  mode: 'dark',
  sectionBackground:
    'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(48,209,88,0.06), transparent 60%),' +
    'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(10,132,255,0.05), transparent 60%),' +
    'linear-gradient(180deg, #06070a 0%, #050608 60%, #07080b 100%)',
  cardBackground:
    'linear-gradient(180deg, rgba(20,20,24,0.85) 0%, rgba(10,10,12,0.85) 100%)',
  cardBorder: '1px solid rgba(255,255,255,0.08)',
  cardShadow: '0 30px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
  headlineGradient: 'linear-gradient(180deg, #fff 0%, #b0b0b8 100%)',
  bodyText: 'rgba(255,255,255,0.55)',
  mutedText: 'rgba(255,255,255,0.4)',
  fadedText: 'rgba(255,255,255,0.3)',
  trackBackground: 'rgba(255,255,255,0.06)',
  hairline: 'rgba(255,255,255,0.06)',
}

const LIGHT_PALETTE: CayleyPalette = {
  mode: 'light',
  // Subtle warm + cool ambient glows on a bone-on-cream gradient. Tuned to
  // feel like an Apple light-mode product page — present but not flat.
  sectionBackground:
    'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(48,209,88,0.06), transparent 60%),' +
    'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(10,132,255,0.04), transparent 60%),' +
    'linear-gradient(180deg, #fafafa 0%, #f5f5f7 60%, #fafafa 100%)',
  cardBackground:
    'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.78) 100%)',
  cardBorder: '1px solid rgba(0,0,0,0.08)',
  cardShadow:
    '0 20px 50px rgba(28,26,28,0.08), 0 4px 12px rgba(28,26,28,0.04), inset 0 1px 0 rgba(255,255,255,0.7)',
  headlineGradient: 'linear-gradient(180deg, #1c1a1c 0%, #4a4a52 100%)',
  bodyText: 'rgba(0,0,0,0.62)',
  mutedText: 'rgba(0,0,0,0.45)',
  fadedText: 'rgba(0,0,0,0.32)',
  trackBackground: 'rgba(0,0,0,0.06)',
  hairline: 'rgba(0,0,0,0.08)',
}

const CayleyThemeContext = createContext<CayleyPalette>(DARK_PALETTE)

export function CayleyThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid an SSR/CSR palette mismatch — render the dark palette until we've
  // mounted and read `resolvedTheme`. Matches how `next-themes` itself
  // hydrates the `class` attribute.
  useEffect(() => setMounted(true), [])

  const palette = mounted && resolvedTheme === 'light' ? LIGHT_PALETTE : DARK_PALETTE

  return (
    <CayleyThemeContext.Provider value={palette}>
      {children}
    </CayleyThemeContext.Provider>
  )
}

export function useCayleyTheme(): CayleyPalette {
  return useContext(CayleyThemeContext)
}
