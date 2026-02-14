'use client'

import { useEffect, useState, useRef } from 'react'

export default function ScrollChinchilla() {
  const [isVisible, setIsVisible] = useState(false)
  const canTrigger = useRef(true)

  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100

      // Reset trigger when scrolled back above 50%
      if (scrollPercent < 50) {
        canTrigger.current = true
      }

      // Show chinchilla when scrolled past 70%
      if (scrollPercent > 70 && canTrigger.current) {
        setIsVisible(true)
        canTrigger.current = false

        // Hide after 3 seconds
        setTimeout(() => {
          setIsVisible(false)
        }, 3000)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      className={`fixed bottom-20 right-0 z-40 transition-transform duration-500 ease-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="relative">
        <img
          src="/images/chinchilla-black.png"
          alt=""
          className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 drop-shadow-lg dark:invert"
        />
        <div className={`absolute -top-8 right-0 sm:-left-16 bg-white dark:bg-gray-800 rounded-lg px-3 py-1 shadow-lg text-sm whitespace-nowrap transition-opacity duration-300 ${
          isVisible ? 'opacity-100 delay-300' : 'opacity-0'
        }`}>
          <span className="text-gray-900 dark:text-gray-100">Hey there! 👋</span>
          <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-white dark:bg-gray-800"></div>
        </div>
      </div>
    </div>
  )
}
