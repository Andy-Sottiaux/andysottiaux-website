'use client'

import { useState, useEffect } from 'react'
import ThemeToggle from './ThemeToggle'

type NavLink = {
  href: string
  label: string
  /** Promote this item with a small green pulsing dot, signalling "live now". */
  live?: boolean
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Skills section was folded into Experience entries (skill chips render
  // in-context per job), so it's removed from the nav. Six items now:
  // About · ● Now · Experience · Projects · Education · Contact.
  const navLinks: NavLink[] = [
    { href: '#about', label: 'About' },
    { href: '#now', label: 'Now', live: true },
    { href: '#experience', label: 'Experience' },
    { href: '#projects', label: 'Projects' },
    { href: '#education', label: 'Education' },
    { href: '#contact', label: 'Contact' },
  ]

  const handleNavClick = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-sm dark:shadow-gray-900/30' : 'bg-black/20 backdrop-blur-sm'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <a
            href="#"
            className={`text-xl font-bold hover:opacity-70 transition-all ${
              isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
            }`}
          >
            Andy Sottiaux
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4 lg:gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-all ${
                  isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
                }`}
              >
                {link.live && <LiveDot />}
                {link.label}
              </a>
            ))}
            <ThemeToggle className={isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'} />
          </div>

          {/* Mobile: Theme Toggle + Menu Button */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle className={isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'} />
            <button
              className="p-2 -mr-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              <svg
                className={`w-6 h-6 transition-all ${
                  isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className={`md:hidden mt-4 pb-4 border-t pt-4 ${isScrolled ? 'border-gray-200 dark:border-gray-700' : 'border-white/20'}`}>
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  className={`inline-flex items-center gap-2 text-base font-medium hover:opacity-70 transition-all ${
                    isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
                  }`}
                >
                  {link.live && <LiveDot />}
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}

/**
 * LiveDot — small pulsing green dot, paired with the "Now" nav link to
 * communicate "this section is currently active / live data inside."
 * Mirrors the eyebrow indicator used on the CurrentProject section.
 */
function LiveDot() {
  return (
    <span
      className="relative inline-flex h-2 w-2 shrink-0"
      aria-hidden="true"
    >
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ background: '#30d158' }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{
          background: '#30d158',
          boxShadow: '0 0 6px rgba(48,209,88,0.8)',
        }}
      />
    </span>
  )
}
