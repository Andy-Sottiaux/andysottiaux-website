'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const options = [
  {
    value: 'system',
    label: 'System theme',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'light',
    label: 'Light theme',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark theme',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
]

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className={`flex items-center rounded-full border border-current/20 p-1 ${className}`}>
        {options.map((opt) => (
          <div key={opt.value} className="p-1.5">
            <div className="w-4 h-4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex items-center rounded-full border border-current/20 p-1 ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`p-1.5 rounded-full transition-colors ${
            theme === opt.value
              ? 'bg-black/10 dark:bg-white/15'
              : 'hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          aria-label={opt.label}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}
