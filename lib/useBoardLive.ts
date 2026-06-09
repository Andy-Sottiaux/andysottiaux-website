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

import { useEffect, useRef, useState } from 'react'

const HEALTH_URL = '/api/v3/health'
const POLL_MS = 15_000
const REQUEST_TIMEOUT_MS = 6_000
const OFFLINE_GRACE_MS = 45_000
const OFFLINE_FAIL_LIMIT = 3

type HealthLoose = { ok?: boolean; error?: string }

export function useBoardLive(initial = true): boolean {
  // Caller can pass an SSR-resolved initial state (page.tsx probes the
  // health endpoint on the server and passes the result down). When given,
  // the initial paint already matches reality — no live→fallback flicker
  // for visitors arriving while the board is down.
  const [live, setLive] = useState(initial)
  // If we already know we're offline, treat "last success" as ancient so
  // client polling keeps us offline until the first good response.
  const lastSuccessRef = useRef<number>(initial ? Date.now() : 0)
  const consecutiveFailRef = useRef<number>(initial ? 0 : OFFLINE_FAIL_LIMIT)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      let ok = false
      try {
        const ctrl = new AbortController()
        const timeoutId = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
        const res = await fetch(HEALTH_URL, { signal: ctrl.signal, cache: 'no-store' })
        clearTimeout(timeoutId)
        if (res.ok) {
          const parsed = (await res.json()) as HealthLoose
          if (parsed && parsed.ok !== false && !parsed.error) {
            ok = true
          }
        }
      } catch {
        ok = false
      }
      if (cancelled) return

      if (ok) {
        lastSuccessRef.current = Date.now()
        consecutiveFailRef.current = 0
        setLive(true)
      } else {
        consecutiveFailRef.current += 1
        const sinceLastOk = Date.now() - lastSuccessRef.current
        if (
          consecutiveFailRef.current >= OFFLINE_FAIL_LIMIT &&
          sinceLastOk >= OFFLINE_GRACE_MS
        ) {
          setLive(false)
        }
      }
      timer = setTimeout(tick, POLL_MS)
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return live
}
