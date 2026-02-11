'use client'

import { useEffect, useState } from 'react'

// Fallback values if API is unavailable
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
    <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            {/* Marathon Logo */}
            <div className="flex-shrink-0">
              <img
                src="/images/tcs-marathon-logo.png"
                alt="2026 TCS New York City Marathon"
                className="w-64 sm:w-72 md:w-80 object-contain"
              />
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                Running the 2026 NYC Marathon
              </h2>
              <p className="text-gray-600 leading-relaxed mb-2">
                I'm running the 2026 TCS New York City Marathon with
                {' '}<span className="font-semibold text-foreground">Team For Kids</span>,
                NYRR's charity team that funds free youth running programs across New York City.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                If you'd like to support, any donation goes directly to keeping these programs running for kids across all five boroughs.
              </p>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-foreground">
                    ${raised.toLocaleString()} raised
                  </span>
                  <span className="text-gray-500">
                    ${goal.toLocaleString()} goal
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#E8642C] transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{percentage}% of goal</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center md:justify-start">
                <a
                  href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-[#E8642C] text-white rounded-lg font-medium hover:bg-[#d15725] transition-all shadow-md"
                >
                  Donate to Team For Kids
                </a>
                <img
                  src="/images/nyrr-qr.png"
                  alt="Scan to donate"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg shadow-md"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="mt-6 bg-[#E8642C] rounded-2xl px-6 sm:px-10 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[#1a1a5e] font-bold text-lg sm:text-xl leading-tight">Marathon Day</p>
            <p className="text-[#1a1a5e] font-bold text-lg sm:text-xl leading-tight">November 1st, 2026</p>
          </div>
          <div className="flex gap-6 sm:gap-8">
            {[
              { value: countdown.days, label: 'DAYS' },
              { value: countdown.hours, label: 'HOURS' },
              { value: countdown.minutes, label: 'MINUTES' },
              { value: countdown.seconds, label: 'SECONDS' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-[#1a1a5e] text-3xl sm:text-5xl font-bold leading-none">{item.value}</p>
                <p className="text-[#1a1a5e] text-[10px] sm:text-xs font-semibold tracking-wider mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
