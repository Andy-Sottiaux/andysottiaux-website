import { NextResponse } from 'next/server'

const FUNDRAISER_URL = 'https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8'
const GOAL = 3000

export async function GET() {
  try {
    const res = await fetch(FUNDRAISER_URL, {
      next: { revalidate: 300 }, // cache for 5 minutes
    })
    const html = await res.text()

    // Parse "Andrew needs $X,XXX.XX to meet the fundraising minimum commitment of $X,XXX.XX"
    const match = html.match(/needs\s+\$([0-9,]+(?:\.\d{2})?)\s+to meet the fundraising minimum commitment of\s+\$([0-9,]+(?:\.\d{2})?)/)

    if (match) {
      const remaining = parseFloat(match[1].replace(',', ''))
      const goal = parseFloat(match[2].replace(',', ''))
      const raised = goal - remaining

      return NextResponse.json({
        raised,
        goal,
        remaining,
        percentage: Math.round((raised / goal) * 100),
      })
    }

    // If the text doesn't match (goal already met), try to find just the goal
    const goalMatch = html.match(/commitment of\s+\$([0-9,]+(?:\.\d{2})?)/)
    if (goalMatch) {
      const goal = parseFloat(goalMatch[1].replace(',', ''))
      return NextResponse.json({
        raised: goal,
        goal,
        remaining: 0,
        percentage: 100,
      })
    }

    // Fallback
    return NextResponse.json({
      raised: null,
      goal: GOAL,
      remaining: null,
      percentage: null,
    })
  } catch {
    return NextResponse.json(
      { raised: null, goal: GOAL, remaining: null, percentage: null },
      { status: 500 }
    )
  }
}
