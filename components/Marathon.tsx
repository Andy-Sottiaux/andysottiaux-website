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
    <a
      href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-8 sm:mt-12 bg-[#E8642C] rounded-2xl p-6 sm:p-8 hover:bg-[#d15725] transition-colors group"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
        {/* Left: Text + Progress */}
        <div className="flex-1 text-center sm:text-left">
          <p className="text-white/70 text-xs font-semibold tracking-wider uppercase mb-1">
            2026 NYC Marathon
          </p>
          <h3 className="text-white font-bold text-xl sm:text-2xl mb-3">
            Running for Team For Kids
          </h3>

          {/* Progress Bar */}
          <div className="max-w-md">
            <div className="w-full bg-white/25 rounded-full h-2.5 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-white/80 text-sm font-medium">
              ${raised.toLocaleString()} raised of ${goal.toLocaleString()} goal
            </p>
          </div>
        </div>

        {/* Right: Countdown + CTA */}
        <div className="flex-shrink-0 text-center">
          <div className="flex gap-5 mb-3">
            {[
              { value: countdown.days, label: 'DAYS' },
              { value: countdown.hours, label: 'HRS' },
              { value: countdown.minutes, label: 'MIN' },
              { value: countdown.seconds, label: 'SEC' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-white text-3xl sm:text-4xl font-bold leading-none">{item.value}</p>
                <p className="text-white/50 text-[10px] font-semibold tracking-wider mt-1">{item.label}</p>
              </div>
            ))}
          </div>
          <span className="inline-block px-5 py-2 bg-white text-[#E8642C] rounded-lg text-sm font-semibold group-hover:shadow-lg transition-all">
            Donate to Team For Kids
          </span>
        </div>
      </div>
    </a>
  )
}
