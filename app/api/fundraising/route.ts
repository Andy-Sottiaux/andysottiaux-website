import { NextResponse } from 'next/server'

const FUNDRAISER_URL = 'https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8'
const GOAL = 3000

// ISR: cache this route response for 5 minutes, then revalidate in the background
export const revalidate = 300

export async function GET() {
  try {
    const res = await fetch(FUNDRAISER_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) {
      console.error(`NYRR fetch returned ${res.status}`)
      return NextResponse.json({ raised: null, goal: GOAL, percentage: null })
    }

    const html = await res.text()

    // Primary pattern: "needs $X to meet the fundraising minimum commitment of $Y"
    const match = html.match(
      /needs\s+(?:<[^>]*>)*\s*\$([0-9,]+(?:\.\d{2})?)\s*(?:<[^>]*>)*\s+to meet the fundraising minimum commitment of\s+(?:<[^>]*>)*\s*\$([0-9,]+(?:\.\d{2})?)/
    )

    if (match) {
      const remaining = parseFloat(match[1].replace(/,/g, ''))
      const goal = parseFloat(match[2].replace(/,/g, ''))
      const raised = Math.round((goal - remaining) * 100) / 100

      return NextResponse.json({
        raised,
        goal,
        percentage: Math.round((raised / goal) * 100),
        timestamp: Date.now(),
      })
    }

    // Fallback: look for "has raised $X" or "raised $X of $Y" patterns
    const raisedMatch = html.match(
      /(?:has\s+)?raised\s+(?:<[^>]*>)*\s*\$([0-9,]+(?:\.\d{2})?)/i
    )
    if (raisedMatch) {
      const raised = parseFloat(raisedMatch[1].replace(/,/g, ''))
      return NextResponse.json({
        raised,
        goal: GOAL,
        percentage: Math.round((raised / GOAL) * 100),
        timestamp: Date.now(),
      })
    }

    // Check if goal was met or exceeded
    if (html.includes('met') || html.includes('exceeded')) {
      return NextResponse.json({
        raised: GOAL,
        goal: GOAL,
        percentage: 100,
        timestamp: Date.now(),
      })
    }

    console.error('NYRR HTML did not match any fundraising pattern')
    return NextResponse.json({ raised: null, goal: GOAL, percentage: null })
  } catch (err) {
    console.error('Fundraising fetch error:', err)
    return NextResponse.json({ raised: null, goal: GOAL, percentage: null })
  }
}
