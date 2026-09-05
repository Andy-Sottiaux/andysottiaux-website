import 'server-only'
import { buildHealthDigest, type HealthPollResult } from './fieldHealth'
import { publicHealth } from './publicTelemetry'
import { readFieldTelemetry } from './server/fieldTelemetry'

/** Initial props use the same allowlist and upstream resolver as the public API. */
export async function probeInitialHealth(): Promise<HealthPollResult> {
  const startedAt = Date.now()
  const result = await readFieldTelemetry('health', '/api/health', 1200)
  if (!result.ok) return { digest: null }
  const body = publicHealth(result.body)
  if (!body) return { digest: null }
  const fetchedAt = Date.now()
  return { digest: buildHealthDigest(body, fetchedAt - startedAt, fetchedAt) }
}
