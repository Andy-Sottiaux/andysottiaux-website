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
        isScrolled ? 'bg-white/90 backdrop-blur-sm shadow-sm' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="#" className="text-xl font-bold text-foreground hover:opacity-70 transition-opacity">
            Andy Sottiaux
          </a>
          <div className="flex gap-8">
            <a href="#about" className="text-sm font-medium hover:opacity-70 transition-opacity">
              About
            </a>
            <a href="#experience" className="text-sm font-medium hover:opacity-70 transition-opacity">
              Experience
            </a>
            <a href="#skills" className="text-sm font-medium hover:opacity-70 transition-opacity">
              Skills
            </a>
            <a href="#projects" className="text-sm font-medium hover:opacity-70 transition-opacity">
              Projects
            </a>
            <a href="#contact" className="text-sm font-medium hover:opacity-70 transition-opacity">
              Contact
            </a>
          </div>
        </div>
      </nav>
    </header>
  )
}
