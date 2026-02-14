'use client'

import { useEffect, useState } from 'react'

const FALLBACK_RAISED = 1776
const FALLBACK_GOAL = 3000
const MARATHON_DATE = new Date('2026-11-01T00:00:00')

function useCountdown() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const diff = Math.max(0, MARATHON_DATE.getTime() - now.getTime())
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  return { days, hours, minutes, seconds }
}

export default function Marathon() {
  const [raised, setRaised] = useState(FALLBACK_RAISED)
  const [goal, setGoal] = useState(FALLBACK_GOAL)
  const [showQR, setShowQR] = useState(false)
  const countdown = useCountdown()

  useEffect(() => {
    fetch('/api/fundraising')
      .then((res) => res.json())
      .then((data) => {
        if (data.raised !== null) {
          setRaised(data.raised)
          setGoal(data.goal)
        }
      })
      .catch(() => {})
  }, [])

  const percentage = Math.round((raised / goal) * 100)

  return (
    <>
      <div className="mt-8 sm:mt-12 bg-[#E8642C] rounded-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left: Logo on white background */}
          <div className="bg-white flex items-center justify-center p-6 md:px-10 md:py-8 md:w-56 flex-shrink-0">
            <img
              src="/images/tcs-marathon-logo.png"
              alt="2026 TCS New York City Marathon"
              className="h-24 md:h-32 object-contain"
            />
          </div>

          {/* Center + Right content */}
          <div className="flex-1 p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
            {/* Center: Title + Progress */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-white/60 text-xs font-semibold tracking-wider uppercase mb-1">
                2026 TCS New York City Marathon
              </p>
              <h3 className="text-white font-bold text-xl sm:text-2xl mb-1">
                Running for Team For Kids
              </h3>
              <p className="text-white/70 text-sm mb-4">
                Fundraising for free youth running programs across NYC
              </p>

              {/* Progress Bar */}
              <div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white font-semibold">
                    ${raised.toLocaleString()} raised
                  </span>
                  <span className="text-white/60">
                    ${goal.toLocaleString()} goal
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Countdown + CTAs */}
            <div className="flex-shrink-0 text-center">
              <div className="flex gap-4 sm:gap-5 mb-4">
                {[
                  { value: countdown.days, label: 'DAYS' },
                  { value: countdown.hours, label: 'HRS' },
                  { value: countdown.minutes, label: 'MIN' },
                  { value: countdown.seconds, label: 'SEC' },
                ].map((item) => (
                  <div key={item.label} className="text-center min-w-[3rem]">
                    <p className="text-white text-3xl sm:text-4xl font-bold leading-none tabular-nums">{item.value}</p>
                    <p className="text-white/50 text-[10px] font-semibold tracking-wider mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <a
                  href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-white text-[#E8642C] rounded-lg text-sm font-bold hover:bg-white/90 hover:shadow-lg transition-all"
                >
                  Donate
                </a>
                <button
                  onClick={() => setShowQR(true)}
                  className="px-3 py-2.5 bg-white/15 text-white rounded-lg hover:bg-white/25 transition-all"
                  aria-label="Show QR code"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center max-w-xs mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-900 dark:text-gray-100 font-bold text-lg mb-1">Scan to Donate</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Team For Kids</p>
            <img
              src="/images/nyrr-qr.png"
              alt="Scan to donate to Team For Kids"
              className="w-48 h-48 mx-auto rounded-lg"
            />
            <button
              onClick={() => setShowQR(false)}
              className="mt-4 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
