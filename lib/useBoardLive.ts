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
 * a single failed poll does NOT flip the tile set — we only flip after we
 * haven't heard a healthy response for 30 s (which is 2 consecutive failed
 * polls plus a small slack). Same idea on the way back up: one good poll
 * brings us back to live immediately.
 */

import { useEffect, useRef, useState } from 'react'

const HEALTH_URL = '/api/v3/health'
const POLL_MS = 8_000
const OFFLINE_GRACE_MS = 10_000

type HealthLoose = { ok?: boolean; error?: string }

export function useBoardLive(initial = true): boolean {
  // Caller can pass an SSR-resolved initial state (page.tsx probes the
  // health endpoint on the server and passes the result down). When given,
  // the initial paint already matches reality — no live→fallback flicker
  // for visitors arriving while the board is down.
  const [live, setLive] = useState(initial)
  // If we already know we're offline, treat "last success" as ancient so
  // a single failed client poll is enough to keep us in offline (no extra
  // grace needed since the server already observed it offline).
  const lastSuccessRef = useRef<number>(initial ? Date.now() : 0)
  const consecutiveFailRef = useRef<number>(initial ? 0 : 1)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      let ok = false
      try {
        const ctrl = new AbortController()
        const timeoutId = setTimeout(() => ctrl.abort(), 8_000)
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
        // Flip to offline once a single failure has persisted past the grace
        // window. Tightened from "2 consecutive + 30s" so the swap is
        // observable within ~10s of the board going down.
        if (sinceLastOk >= OFFLINE_GRACE_MS) {
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
