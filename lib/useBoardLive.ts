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
const POLL_MS = 15_000
const OFFLINE_GRACE_MS = 30_000

type HealthLoose = { ok?: boolean; error?: string }

export function useBoardLive(): boolean {
  // Default to `true` so first paint matches the historical layout (live
  // tiles), avoiding a fallback-then-live flicker when the first poll
  // succeeds. If the device IS offline, we'll flip after the grace window.
  const [live, setLive] = useState(true)
  const lastSuccessRef = useRef<number>(Date.now())
  const consecutiveFailRef = useRef<number>(0)

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
        // Flip to offline only after we've gone past the grace window AND
        // observed at least 2 consecutive failures. Either condition alone
        // could be a transient blip.
        if (consecutiveFailRef.current >= 2 && sinceLastOk >= OFFLINE_GRACE_MS) {
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
