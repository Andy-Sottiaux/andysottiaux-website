import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const UPSTREAM =
  process.env.V3_SOLAR_HISTORY_UPSTREAM_HOST ||
  process.env.V3_SOLAR_UPSTREAM_HOST ||
  process.env.V3_UPSTREAM_HOST ||
  'https://cayley-relay.tailc7d6b6.ts.net'

type HistoryShape = {
  points?: unknown
  history?: unknown
  data?: unknown
  buckets?: unknown
  [key: string]: unknown
}

const DEFAULT_HOURS = 24
const MIN_POINTS = 24
const MAX_POINTS = 720

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const hours = clampInt(requestUrl.searchParams.get('hours'), 1, 48, DEFAULT_HOURS)
  const requestedPoints = clampOptionalInt(requestUrl.searchParams.get('points'), MIN_POINTS, MAX_POINTS)

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(`${UPSTREAM}/api/solar/history?hours=${hours}`, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'andysottiaux.com/solar-history-proxy' },
    })
    clearTimeout(timeoutId)

    const body = await r.text()
    const upstreamCt = r.headers.get('content-type') || 'application/json'
    if (!requestedPoints || !r.ok) {
      return new NextResponse(body, {
        status: r.status,
        headers: {
          'Content-Type': upstreamCt,
          'Cache-Control': 'no-store',
        },
      })
    }

    try {
      const parsed = JSON.parse(body) as unknown
      const sampled = sampleHistoryPayload(parsed, requestedPoints)
      return NextResponse.json(sampled, {
        status: r.status,
        headers: {
          'Cache-Control': 'no-store',
        },
      })
    } catch {
      // If the upstream shape changes or sends non-JSON, keep the previous
      // pass-through behavior rather than breaking the card.
    }

    return new NextResponse(body, {
      status: r.status,
      headers: {
        'Content-Type': upstreamCt,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'history_unavailable' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}

function clampOptionalInt(value: string | null, min: number, max: number): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return null
  return Math.max(min, Math.min(max, parsed))
}

function clampInt(value: string | null, min: number, max: number, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function sampleHistoryPayload(data: unknown, maxPoints: number): unknown {
  const { items, key } = historyItems(data)
  if (items.length <= maxPoints) return data

  const sampled = downsampleHistory(items, maxPoints)
  if (Array.isArray(data)) return sampled

  if (data && typeof data === 'object') {
    return {
      ...(data as HistoryShape),
      [key]: sampled,
      sampled_points: sampled.length,
      source_points: items.length,
    }
  }

  return { points: sampled, sampled_points: sampled.length, source_points: items.length }
}

function historyItems(data: unknown): { items: unknown[]; key: 'points' | 'history' | 'data' | 'buckets' } {
  if (Array.isArray(data)) return { items: data, key: 'points' }
  const root = data as HistoryShape
  if (Array.isArray(root?.points)) return { items: root.points, key: 'points' }
  if (Array.isArray(root?.history)) return { items: root.history, key: 'history' }
  if (Array.isArray(root?.data)) return { items: root.data, key: 'data' }
  if (Array.isArray(root?.buckets)) return { items: root.buckets, key: 'buckets' }
  return { items: [], key: 'points' }
}

function downsampleHistory(items: unknown[], maxPoints: number): unknown[] {
  if (items.length <= maxPoints) return items

  const sorted = items.toSorted((a, b) => pointTimestamp(a) - pointTimestamp(b))
  const sampled: unknown[] = []
  const bucketSize = sorted.length / maxPoints

  for (let i = 0; i < maxPoints; i += 1) {
    const start = Math.floor(i * bucketSize)
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize))
    const bucket = sorted.slice(start, Math.min(sorted.length, end))
    if (bucket.length === 0) continue

    if (i === 0) {
      sampled.push(bucket[0])
      continue
    }
    if (i === maxPoints - 1) {
      sampled.push(bucket[bucket.length - 1])
      continue
    }

    sampled.push(selectRepresentativePoint(bucket))
  }

  return sampled
}

function selectRepresentativePoint(bucket: unknown[]): unknown {
  let best = bucket[Math.floor(bucket.length / 2)]
  let bestPower = -Infinity

  for (const item of bucket) {
    const power = numericField(item, ['solar_power', 'solarPower', 'pv_power_w', 'pvPowerW'])
    if (power != null && power > bestPower) {
      best = item
      bestPower = power
    }
  }

  return best
}

function pointTimestamp(item: unknown): number {
  return numericField(item, ['timestamp', 'ts', 'time']) ?? 0
}

function numericField(item: unknown, keys: string[]): number | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  for (const key of keys) {
    const raw = record[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string') {
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}
