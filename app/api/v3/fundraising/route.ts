import { NextResponse } from 'next/server'

// Race campaign for the AMOLED desk display (andysottiaux.com/work/amoled-dashboard).
// The display compiles in the race itself (date and artwork) and reads the
// charity and fundraising progress here, so a new charity or fundraising page
// needs no firmware change. While no fundraising page is set up, `configured`
// is false and the display shows a placeholder instead of numbers.
//
// The portfolio's own marathon tile still reads /api/fundraising (2026 NYC).
const CAMPAIGN = {
  id: 'chicago-2027',
  race: '2027 Bank of America Chicago Marathon',
  raceDate: '2027-10-10',
  charity: null as string | null,
  goal: null as number | null,
}

export const revalidate = 300

export async function GET() {
  return NextResponse.json({
    campaign: CAMPAIGN.id,
    race: CAMPAIGN.race,
    race_date: CAMPAIGN.raceDate,
    charity: CAMPAIGN.charity,
    configured: false,
    raised: null,
    goal: CAMPAIGN.goal,
    percentage: null,
    timestamp: Date.now(),
  })
}
