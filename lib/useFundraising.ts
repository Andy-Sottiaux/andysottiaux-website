'use client'

import { useEffect, useState } from 'react'
import { fetchWithTimeout } from './fetchWithTimeout'

export const FALLBACK_RAISED = 1806
export const FALLBACK_GOAL = 3000

type FundraisingResult = {
  goal: number
  raised: number
}

async function fetchFundraising(signal: AbortSignal): Promise<FundraisingResult> {
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
  const [data, setData] = useState<FundraisingResult>(() => ({
    raised: FALLBACK_RAISED,
    goal: FALLBACK_GOAL,
  }))

  useEffect(() => {
    let cancelled = false
    let ctrl: AbortController | null = null

    const poll = async () => {
      ctrl?.abort()
      ctrl = new AbortController()
      const next = await fetchFundraising(ctrl.signal)
      if (!cancelled) setData(next)
    }

    poll()
    const timer = window.setInterval(poll, 10 * 60_000)
    return () => {
      cancelled = true
      ctrl?.abort()
      window.clearInterval(timer)
    }
  }, [])

  return data
}
