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
    <div className="mt-8 sm:mt-12 bg-[#E8642C] rounded-2xl p-5 sm:p-6 md:p-8 overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-center">
        {/* Left: Logo + Info */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 flex-1 min-w-0">
          <img
            src="/images/tcs-marathon-logo.png"
            alt="2026 TCS New York City Marathon"
            className="w-36 sm:w-44 object-contain flex-shrink-0"
          />
          <div className="text-center sm:text-left min-w-0">
            <h3 className="text-white font-bold text-lg sm:text-xl mb-1">
              Running for Team For Kids
            </h3>
            <p className="text-white/80 text-sm leading-snug mb-3">
              Fundraising for free youth running programs across NYC.
            </p>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-white">
                  ${raised.toLocaleString()} raised
                </span>
                <span className="text-white/70">
                  ${goal.toLocaleString()} goal
                </span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <a
                href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white text-[#E8642C] rounded-lg text-sm font-semibold hover:bg-white/90 transition-all shadow-md"
              >
                Donate
              </a>
              <img
                src="/images/nyrr-qr.png"
                alt="Scan to donate"
                className="w-16 h-16 rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>

        {/* Right: Countdown */}
        <div className="flex-shrink-0">
          <p className="text-white/70 text-xs font-semibold tracking-wider text-center mb-2 uppercase">
            November 1st, 2026
          </p>
          <div className="flex gap-4 sm:gap-5">
            {[
              { value: countdown.days, label: 'DAYS' },
              { value: countdown.hours, label: 'HRS' },
              { value: countdown.minutes, label: 'MIN' },
              { value: countdown.seconds, label: 'SEC' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-white text-2xl sm:text-3xl font-bold leading-none">{item.value}</p>
                <p className="text-white/60 text-[10px] font-semibold tracking-wider mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
