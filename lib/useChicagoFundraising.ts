'use client'

import { fetchWithTimeout } from './fetchWithTimeout'
import { useSharedPoll } from './useSharedPoll'
import { CHICAGO_CAMPAIGN } from '@/content/chicagoCampaign'

const FUNDRAISING_URL = '/api/v3/fundraising'
// The route caches GivenGain for five minutes, so polling faster adds nothing.
const POLL_MS = 5 * 60_000

type Totals = { raised: number; goal: number }

async function fetchTotals(signal: AbortSignal): Promise<Totals> {
  const res = await fetchWithTimeout(FUNDRAISING_URL, { signal, cache: 'no-store' }, 8_000)
  if (!res.ok) throw new Error(`Fundraising endpoint returned ${res.status}`)
  const data = (await res.json()) as { raised?: unknown; goal?: unknown }
  if (typeof data.raised !== 'number' || !Number.isFinite(data.raised)) {
    // Throwing keeps the last good total on screen.
    throw new Error('Fundraising total unavailable')
  }
  const goal = typeof data.goal === 'number' && data.goal > 0 ? data.goal : CHICAGO_CAMPAIGN.goal
  return { raised: data.raised, goal }
}

/**
 * Live Team One Tail total from Andy's GivenGain page, shared by the Chicago
 * card and its modal. `raised` stays null until the first reading arrives.
 */
export function useChicagoFundraising(): { raised: number | null; goal: number } {
  const totals = useSharedPoll(FUNDRAISING_URL, fetchTotals, POLL_MS)
  return { raised: totals?.raised ?? null, goal: totals?.goal ?? CHICAGO_CAMPAIGN.goal }
}
