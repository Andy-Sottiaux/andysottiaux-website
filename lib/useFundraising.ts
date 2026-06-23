'use client'

import { useQuery, type QueryFunctionContext } from '@tanstack/react-query'
import { fetchWithTimeout } from './fetchWithTimeout'

export const FALLBACK_RAISED = 1806
export const FALLBACK_GOAL = 3000

const FUNDRAISING_QUERY_KEY = ['fundraising'] as const

type FundraisingResult = {
  goal: number
  raised: number
}

async function fetchFundraising({
  signal,
}: QueryFunctionContext<typeof FUNDRAISING_QUERY_KEY>): Promise<FundraisingResult> {
  try {
    const res = await fetchWithTimeout('/api/fundraising', { signal, cache: 'no-store' }, 8_000)
    if (!res.ok) return { raised: FALLBACK_RAISED, goal: FALLBACK_GOAL }

    const data = await res.json() as Partial<FundraisingResult>
    if (data.raised == null) return { raised: FALLBACK_RAISED, goal: FALLBACK_GOAL }

    return {
      raised: data.raised,
      goal: data.goal ?? FALLBACK_GOAL,
    }
  } catch {
    return { raised: FALLBACK_RAISED, goal: FALLBACK_GOAL }
  }
}

export function useFundraising(): FundraisingResult {
  const { data } = useQuery({
    queryKey: FUNDRAISING_QUERY_KEY,
    queryFn: fetchFundraising,
    refetchInterval: 10 * 60_000,
    staleTime: 60_000,
  })

  return data ?? { raised: FALLBACK_RAISED, goal: FALLBACK_GOAL }
}
