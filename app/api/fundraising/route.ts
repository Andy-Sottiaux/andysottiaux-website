import { NextResponse } from 'next/server'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const FUNDRAISER_URL = 'https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8'
const GOAL = 3000

// Cache the result in memory between invocations
let cachedData: { raised: number; goal: number; percentage: number; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData)
  }

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.goto(FUNDRAISER_URL, { waitUntil: 'networkidle2', timeout: 15000 })

    // Wait for the fundraising text to render
    await page.waitForFunction(
      () => document.body.innerText.includes('fundraising minimum commitment'),
      { timeout: 10000 }
    ).catch(() => {})

    const text = await page.evaluate(() => document.body.innerText)
    await browser.close()

    // Parse "Andrew needs $X,XXX.XX to meet the fundraising minimum commitment of $X,XXX.XX"
    const match = text.match(/needs\s+\$([0-9,]+(?:\.\d{2})?)\s+to meet the fundraising minimum commitment of\s+\$([0-9,]+(?:\.\d{2})?)/)

    if (match) {
      const remaining = parseFloat(match[1].replace(/,/g, ''))
      const goal = parseFloat(match[2].replace(/,/g, ''))
      const raised = goal - remaining

      cachedData = {
        raised,
        goal,
        percentage: Math.round((raised / goal) * 100),
        timestamp: Date.now(),
      }

      return NextResponse.json(cachedData)
    }

    // Fallback if pattern changed but goal was met
    if (text.includes('met') || text.includes('exceeded')) {
      cachedData = { raised: GOAL, goal: GOAL, percentage: 100, timestamp: Date.now() }
      return NextResponse.json(cachedData)
    }

    return NextResponse.json({ raised: null, goal: GOAL, percentage: null })
  } catch (err) {
    console.error('Fundraising scrape error:', err)
    // Return cached data even if stale, or null
    if (cachedData) {
      return NextResponse.json(cachedData)
    }
    return NextResponse.json({ raised: null, goal: GOAL, percentage: null })
  }
}
