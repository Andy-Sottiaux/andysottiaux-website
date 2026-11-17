// Renders scripts/og-image/og.html to the site's link-preview images.
//
//   node scripts/og-image/render.mjs --font /path/to/InterVariable.woff2
//
// The design uses Inter (SIL OFL). Without --font it falls back to the system
// sans-serif, which changes the letterforms.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const fontArg = process.argv.indexOf('--font')
const font = fontArg > 0 ? pathToFileURL(resolve(process.argv[fontArg + 1])).href : ''

const html = (await readFile(join(here, 'og.html'), 'utf8'))
  .replace('__FONT__', font)
  .replaceAll('../../public/', pathToFileURL(join(root, 'public')).href + '/')
const work = await mkdtemp(join(tmpdir(), 'og-image-'))
const page = join(work, 'og.html')
await writeFile(page, html)

const browser = await chromium.launch()
try {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await tab.goto(pathToFileURL(page).href)
  await tab.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode()))
  })
  if (font && !(await tab.evaluate(() => document.fonts.check('600 92px InterOG')))) {
    throw new Error('Inter did not load; check the --font path')
  }
  const png = await tab.screenshot({ type: 'png' })
  for (const name of ['opengraph-image.png', 'twitter-image.png']) {
    await writeFile(join(root, 'app', name), png)
    console.log(`Wrote app/${name}`)
  }
} finally {
  await browser.close()
  await rm(work, { recursive: true, force: true })
}
