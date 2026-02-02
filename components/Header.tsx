'use client'

import { useState, useEffect } from 'react'

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm' : 'bg-black/20 backdrop-blur-sm'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a
            href="#"
            className={`text-xl font-bold hover:opacity-70 transition-all ${
              isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
            }`}
          >
            Andy Sottiaux
          </a>
          <div className="flex gap-8">
            <a
              href="#about"
              className={`text-sm font-medium hover:opacity-70 transition-all ${
                isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
              }`}
            >
              About
            </a>
            <a
              href="#experience"
              className={`text-sm font-medium hover:opacity-70 transition-all ${
                isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
              }`}
            >
              Experience
            </a>
            <a
              href="#skills"
              className={`text-sm font-medium hover:opacity-70 transition-all ${
                isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
              }`}
            >
              Skills
            </a>
            <a
              href="#projects"
              className={`text-sm font-medium hover:opacity-70 transition-all ${
                isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
              }`}
            >
              Projects
            </a>
            <a
              href="#aerospace"
              className={`text-sm font-medium hover:opacity-70 transition-all ${
                isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
              }`}
            >
              Aerospace
            </a>
            <a
              href="#contact"
              className={`text-sm font-medium hover:opacity-70 transition-all ${
                isScrolled ? 'text-foreground' : 'text-white drop-shadow-md'
              }`}
            >
              Contact
            </a>
          </div>
        </div>
      </nav>
    </header>
  )
}
