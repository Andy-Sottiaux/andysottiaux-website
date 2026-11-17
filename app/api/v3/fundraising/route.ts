import { NextResponse } from 'next/server'
import { CHICAGO_CAMPAIGN } from '@/content/chicagoCampaign'
import { fetchGivenGainTotals } from '@/lib/server/givengain'

// Race campaign for the AMOLED desk display (andysottiaux.com/work/amoled-dashboard)
// and the portfolio's Chicago card. The display compiles in the race itself
// (date and artwork) and reads the charity and fundraising progress here, so a
// new charity or fundraising page needs no firmware change.
//
// The total is read live from Andy's GivenGain page. If GivenGain can't be read,
// `raised` is null: the display keeps its last reading and marks it stale, and
// the card keeps its last value.
//
// The NYC 2026 Team for Kids total stays at /api/fundraising.
const RACE = {
  id: 'chicago-2027',
  name: '2027 Bank of America Chicago Marathon',
  date: '2027-10-10',
}

export const revalidate = 300

export async function GET() {
  const totals = await fetchGivenGainTotals(CHICAGO_CAMPAIGN.givenGainProjectId, revalidate)
  const goal = totals?.goal ?? CHICAGO_CAMPAIGN.goal
  const raised = totals?.raised ?? null
  return NextResponse.json({
    campaign: RACE.id,
    race: RACE.name,
    race_date: RACE.date,
    team: CHICAGO_CAMPAIGN.team,
    charity: CHICAGO_CAMPAIGN.charity,
    url: CHICAGO_CAMPAIGN.url,
    configured: true,
    raised,
    goal,
    percentage: raised === null ? null : Math.round((raised / goal) * 100),
    timestamp: Date.now(),
  })
}
