import { NextResponse } from 'next/server'

const FUNDRAISER_URL = 'https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8'
const GOAL = 3000

export const revalidate = 300 // revalidate every 5 minutes

export async function GET() {
  try {
    const res = await fetch(FUNDRAISER_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
    })
    const html = await res.text()

    // Parse "Andrew needs $X,XXX.XX to meet the fundraising minimum commitment of $X,XXX.XX"
    const match = html.match(/needs\s+\$([0-9,]+(?:\.\d{2})?)\s+to meet the fundraising minimum commitment of\s+\$([0-9,]+(?:\.\d{2})?)/)

    if (match) {
      const remaining = parseFloat(match[1].replace(/,/g, ''))
      const goal = parseFloat(match[2].replace(/,/g, ''))
      const raised = goal - remaining

      return NextResponse.json({
        raised,
        goal,
        remaining,
        percentage: Math.round((raised / goal) * 100),
      })
    }

    // Try alternate patterns - look for dollar amounts near "raised" or "goal"
    const dollarAmounts = html.match(/\$([0-9,]+(?:\.\d{2})?)/g)
    if (dollarAmounts && dollarAmounts.length >= 2) {
      // Log for debugging
      console.log('NYRR page dollar amounts found:', dollarAmounts)
    }

    // Fallback - return null so the UI hides gracefully
    return NextResponse.json({
      raised: null,
      goal: GOAL,
      remaining: null,
      percentage: null,
      debug: dollarAmounts || 'no dollar amounts found',
    })
  } catch (err) {
    console.error('Fundraising fetch error:', err)
    return NextResponse.json(
      { raised: null, goal: GOAL, remaining: null, percentage: null },
      { status: 500 }
    )
  }
}
