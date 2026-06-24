#!/usr/bin/env node

import { spawn } from 'node:child_process'

const targetUrl = process.env.PROD_SCORE_URL || process.argv[2] || 'https://andysottiaux.com'
const strategies = (process.env.PROD_SCORE_STRATEGIES || 'mobile,desktop')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const requirePageSpeed = process.env.PROD_SCORE_REQUIRE_PAGESPEED === '1'
const budgets = {
  performance: Number.parseInt(process.env.PROD_SCORE_MIN_PERFORMANCE || '80', 10),
  accessibility: Number.parseInt(process.env.PROD_SCORE_MIN_ACCESSIBILITY || '95', 10),
  'best-practices': Number.parseInt(process.env.PROD_SCORE_MIN_BEST_PRACTICES || '95', 10),
  seo: Number.parseInt(process.env.PROD_SCORE_MIN_SEO || '95', 10),
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`))
    })
  })
}

await run('node', [new URL('./audit-home-performance.mjs', import.meta.url).pathname, targetUrl])

async function fetchPageSpeed(strategy) {
  const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  url.searchParams.set('url', targetUrl)
  url.searchParams.set('strategy', strategy)
  for (const category of Object.keys(budgets)) {
    url.searchParams.append('category', category)
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'andysottiaux.com-production-score' },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error?.message || `PageSpeed ${strategy} returned HTTP ${response.status}`)
  }

  return body
}

const reports = []
const pageSpeedErrors = []

for (const strategy of strategies) {
  let result
  try {
    result = await fetchPageSpeed(strategy)
  } catch (error) {
    pageSpeedErrors.push({
      strategy,
      error: error instanceof Error ? error.message : String(error),
    })
    continue
  }
  const categories = result?.lighthouseResult?.categories
  if (!categories) throw new Error(`PageSpeed ${strategy} did not return Lighthouse categories.`)
  const scores = Object.fromEntries(
    Object.entries(budgets).map(([category, min]) => {
      const score = Math.round((categories[category]?.score ?? 0) * 100)
      return [category, { score, min, ok: score >= min }]
    }),
  )
  reports.push({ strategy, scores })
}

const failing = reports.flatMap((report) =>
  Object.entries(report.scores)
    .filter(([, value]) => !value.ok)
    .map(([category, value]) => ({ strategy: report.strategy, category, ...value })),
)

const output = {
  ok: failing.length === 0 && (!requirePageSpeed || pageSpeedErrors.length === 0),
  targetUrl,
  reports,
  failing,
  pageSpeedErrors,
  pageSpeedRequired: requirePageSpeed,
}

if (!output.ok) {
  console.error(JSON.stringify(output, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(output, null, 2))
