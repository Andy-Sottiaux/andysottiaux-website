import 'server-only'

// GivenGain's public project API: the same JSON its own project page and
// progress widget read. GivenGain's web pages sit behind a bot challenge, so
// this reads the API only and never scrapes a page.
const PROJECT_API = 'https://api.givengain.com/v4/project'

type ProjectJson = {
  stats?: { total?: unknown }
  amountRaised?: unknown
  target?: unknown
}

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Live total and target for a published GivenGain project, or null if unavailable. */
export async function fetchGivenGainTotals(
  projectId: number,
  revalidate: number,
): Promise<{ raised: number; goal: number } | null> {
  try {
    const res = await fetch(`${PROJECT_API}/${projectId}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      console.error(`GivenGain API returned ${res.status}`)
      return null
    }
    const project = (await res.json()) as ProjectJson
    // GivenGain's own page shows stats.total: online gifts plus any added off-platform.
    const raised = amount(project.stats?.total) ?? amount(project.amountRaised)
    const goal = amount(project.target)
    if (raised === null || !goal) {
      console.error('GivenGain project JSON had no usable total or target')
      return null
    }
    return { raised, goal }
  } catch (err) {
    console.error('GivenGain fetch error:', err)
    return null
  }
}
