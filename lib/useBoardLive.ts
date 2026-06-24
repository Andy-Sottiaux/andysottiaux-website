'use client'

/**
 * useBoardLive — single source of truth for "is the field board reachable?"
 *
 * Compact view used to render three independent cards (Solar / Camera /
 * Health), each with its own polished offline placeholder. Three placeholders
 * in a row, however, signaled "this site is broken." This hook lets the bento
 * grid swap to a polished alternate set of tiles when the board is offline,
 * so visitors don't see a wall of "Reconnecting…".
 *
 * Polls `/api/v3/health` every 15 s. Live = at least one successful 2xx
 * response with `ok: true` within the last `OFFLINE_GRACE_MS`. Hysteresis:
 * transient health failures do not flip the tile set; a page-level fallback
 * only appears after several consecutive failures and a long stale window.
 * Same idea on the way back up: one good poll brings us back to live
 * immediately.
 */

import { useEffect, useState } from 'react'
import { fetchWithTimeout } from './fetchWithTimeout'

const HEALTH_URL = '/api/v3/health'
const POLL_MS = 15_000
const REQUEST_TIMEOUT_MS = 6_000
const OFFLINE_GRACE_MS = 45_000
const OFFLINE_FAIL_LIMIT = 3

type HealthLoose = { ok?: boolean; error?: string }

async function fetchBoardHealth(signal: AbortSignal): Promise<true> {
  const res = await fetchWithTimeout(HEALTH_URL, { signal, cache: 'no-store' }, REQUEST_TIMEOUT_MS)
  if (!res.ok) throw new Error(`health_http_${res.status}`)

  const parsed = (await res.json()) as HealthLoose
  if (!parsed || parsed.ok === false || parsed.error) {
    throw new Error(parsed?.error || 'health_not_ok')
  }

  return true
}

export function useBoardLive(initial = true): boolean {
  const [state, setState] = useState(() => ({
    ok: initial,
    lastSuccessAt: initial ? Date.now() : 0,
    failureCount: initial ? 0 : OFFLINE_FAIL_LIMIT,
  }))

  useEffect(() => {
    let cancelled = false
    let ctrl: AbortController | null = null

    const poll = async () => {
      ctrl?.abort()
      ctrl = new AbortController()
      try {
        await fetchBoardHealth(ctrl.signal)
        if (!cancelled) {
          setState({ ok: true, lastSuccessAt: Date.now(), failureCount: 0 })
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            ok: false,
            lastSuccessAt: prev.lastSuccessAt,
            failureCount: prev.failureCount + 1,
          }))
        }
      }
    }

    let interval: number | null = null
    const firstTimer = window.setTimeout(() => {
      poll()
      interval = window.setInterval(poll, POLL_MS)
    }, initial ? POLL_MS : 0)

    return () => {
      cancelled = true
      ctrl?.abort()
      window.clearTimeout(firstTimer)
      if (interval) window.clearInterval(interval)
    }
  }, [initial])

  if (state.ok) return true

  const lastSuccessAt = state.lastSuccessAt
  if (lastSuccessAt <= 0) return false

  const sinceLastOk = Date.now() - lastSuccessAt
  return state.failureCount < OFFLINE_FAIL_LIMIT || sinceLastOk < OFFLINE_GRACE_MS
}
