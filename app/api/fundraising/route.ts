import { NextResponse } from 'next/server'

const FUNDRAISER_URL = 'https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8'
const GOAL = 3000

// Cache the result in memory between invocations
let cachedData: { raised: number; goal: number; percentage: number; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData)
  }

  try {
    const res = await fetch(FUNDRAISER_URL)
    const html = await res.text()

    // HTML contains: needs <span class="amount">$1,219.00</span> to meet the fundraising minimum commitment of <span class="total">$3,000.00</span>
    const match = html.match(/needs\s+(?:<[^>]*>)*\s*\$([0-9,]+(?:\.\d{2})?)\s*(?:<[^>]*>)*\s+to meet the fundraising minimum commitment of\s+(?:<[^>]*>)*\s*\$([0-9,]+(?:\.\d{2})?)/)

    if (match) {
      const remaining = parseFloat(match[1].replace(/,/g, ''))
      const goal = parseFloat(match[2].replace(/,/g, ''))
      const raised = Math.round((goal - remaining) * 100) / 100

      cachedData = {
        raised,
        goal,
        percentage: Math.round((raised / goal) * 100),
        timestamp: Date.now(),
      }

      return NextResponse.json(cachedData)
    }

    // Fallback if pattern changed but goal was met
    if (html.includes('met') || html.includes('exceeded')) {
      cachedData = { raised: GOAL, goal: GOAL, percentage: 100, timestamp: Date.now() }
      return NextResponse.json(cachedData)
    }

    return NextResponse.json({ raised: null, goal: GOAL, percentage: null })
  } catch (err) {
    console.error('Fundraising fetch error:', err)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }
    return NextResponse.json({ raised: null, goal: GOAL, percentage: null })
  }
}
