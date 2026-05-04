'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// Site is dark-only. `forcedTheme="dark"` overrides the user/system pref
// so any in-page ThemeToggle, OS setting, or stale storage value still
// renders dark. Keep next-themes wired (rather than ripping it out)
// because individual components still consult `useTheme()` for branching.
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" forcedTheme="dark" defaultTheme="dark">
      {children}
    </NextThemesProvider>
  )
}
