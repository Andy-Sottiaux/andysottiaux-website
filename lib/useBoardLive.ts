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

import { useQuery } from '@tanstack/react-query'
import { fetchWithTimeout } from './fetchWithTimeout'

const HEALTH_URL = '/api/v3/health'
const POLL_MS = 15_000
const REQUEST_TIMEOUT_MS = 6_000
const OFFLINE_GRACE_MS = 45_000
const OFFLINE_FAIL_LIMIT = 3

type HealthLoose = { ok?: boolean; error?: string }
type BoardHealthResult = { ok: boolean }

async function fetchBoardHealth({ signal }: { signal: AbortSignal }): Promise<BoardHealthResult> {
  const res = await fetchWithTimeout(HEALTH_URL, { signal, cache: 'no-store' }, REQUEST_TIMEOUT_MS)
  if (!res.ok) throw new Error(`health_http_${res.status}`)

  const parsed = (await res.json()) as HealthLoose
  if (!parsed || parsed.ok === false || parsed.error) {
    throw new Error(parsed?.error || 'health_not_ok')
  }

  return { ok: true }
}

export function useBoardLive(initial = true): boolean {
  const { data, dataUpdatedAt, failureCount } = useQuery({
    queryKey: ['board-live'],
    queryFn: fetchBoardHealth,
    refetchInterval: POLL_MS,
    initialData: { ok: initial },
    initialDataUpdatedAt: Date.now(),
    staleTime: POLL_MS,
  })

  if (data?.ok !== true) return false

  const lastSuccessAt = dataUpdatedAt
  if (lastSuccessAt <= 0) return false

  const sinceLastOk = Date.now() - lastSuccessAt
  return failureCount < OFFLINE_FAIL_LIMIT || sinceLastOk < OFFLINE_GRACE_MS
}
