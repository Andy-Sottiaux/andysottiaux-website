import 'server-only'
import { buildHealthDigest, healthLooksLive, type HealthLoose, type HealthPollResult } from './fieldHealth'

const HEALTH_TIMEOUT_MS = 1200
const HEALTH_UPSTREAM = (
  process.env.V3_HEALTH_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'
).replace(/\/+$/, '')

/** Share the initial read-only health probe across compact dashboard routes. */
export async function probeInitialHealth(): Promise<HealthPollResult> {
  const startedAt = Date.now()
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(`${HEALTH_UPSTREAM}/api/health`, {
      next: { revalidate: 15 },
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/initial-health' },
    })
    if (!response.ok) return { digest: null }

    const body = (await response.json()) as HealthLoose
    if (!healthLooksLive(body)) return { digest: null }

    const fetchedAt = Date.now()
    return { digest: buildHealthDigest(body, fetchedAt - startedAt, fetchedAt) }
  } catch {
    return { digest: null }
  } finally {
    clearTimeout(timeout)
  }
}
