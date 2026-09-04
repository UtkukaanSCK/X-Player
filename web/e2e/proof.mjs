/**
 * The page makes claims about two players. This checks every one of them.
 *
 * The comparison is the whole point of the site, so it cannot be allowed to
 * quietly stop working - a throttle that silently does nothing would leave two
 * identical videos playing happily beside a caption insisting one of them is in
 * trouble. Everything below is measured off the real elements.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5175'

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const pageErrors = []
page.on('pageerror', (err) => pageErrors.push(String(err.message)))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#proof [role="radio"]', { timeout: 30_000 })

/*
 * Waiting for the worker to actually take control, rather than for a guessed
 * number of seconds.
 *
 * A newly installed worker does not control the page that registered it until it
 * claims its clients, and on a cold first visit - empty HTTP cache, a server
 * that has just started - that took longer than the four seconds this used to
 * sleep through. It failed the suite once in five runs and passed on every
 * retry, which is the worst way for a check to behave.
 */
let controlled = true
try {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 })
} catch {
  controlled = false
}

// Both players still need a moment on the clock before any rate below means
// anything; this part is a warm-up, not a race being waited on.
await page.waitForTimeout(4000)

/** Both players, read straight off the elements. */
const readBoth = () =>
  page.evaluate(() => {
    const bare = document.querySelector('#proof video:not(.xp-video)')
    const xp = document.querySelector('#proof video.xp-video')
    const at = (v) => (v ? Number(v.currentTime.toFixed(2)) : -1)
    return {
      bare: { t: at(bare), error: bare?.error?.code ?? null, paused: bare?.paused ?? null },
      xp: { t: at(xp), error: xp?.error?.code ?? null, paused: xp?.paused ?? null },
    }
  })

const pick = (label) => page.locator('#proof [role="radio"]', { hasText: label }).click()

/* ------------------------------------------------------------ the apparatus */

check(
  'the throttling worker is controlling the page',
  controlled,
  'without it there is nothing to demonstrate',
)

check(
  'both players are on the page at once',
  await page.evaluate(
    () =>
      !!document.querySelector('#proof video:not(.xp-video)') && !!document.querySelector('#proof video.xp-video'),
  ),
)

check('the page says it is doing the throttling itself', (await page.locator('#proof').innerText()).includes('service worker'))

/* ---------------------------------------------------------------- full speed */

await pick('Normal')
await page.waitForTimeout(6000)
const fast = await readBoth()
check('at full speed both actually play', fast.bare.t > 2 && fast.xp.t > 2, JSON.stringify(fast))

/* ----------------------------------------------------------------- throttled */

await pick('Slow 2G')
await page.waitForTimeout(12_000)
const slowBefore = await readBoth()
await page.waitForTimeout(8000)
const slowAfter = await readBoth()

const bareRate = slowAfter.bare.t - slowBefore.bare.t
const xpRate = slowAfter.xp.t - slowBefore.xp.t
check(
  'the throttle really bites: both crawl well behind real time',
  bareRate < 4 && xpRate < 4,
  `8 s of wall clock bought ${bareRate.toFixed(1)} s and ${xpRate.toFixed(1)} s of video`,
)
check(
  'neither is given an advantage over the other',
  Math.abs(bareRate - xpRate) < 3,
  `${bareRate.toFixed(1)} s vs ${xpRate.toFixed(1)} s`,
)

/* ------------------------------------------------- reloading starts over */

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4))
await page.waitForTimeout(600)
const scrolledTo = await page.evaluate(() => Math.round(window.scrollY))
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('#proof [role="radio"]', { timeout: 30_000 })
await page.waitForTimeout(1200)
const afterReload = await page.evaluate(() => Math.round(window.scrollY))
check('reloading puts you back at the top', afterReload === 0, `was ${scrolledTo}px, now ${afterReload}px`)
check(
  'and the connection starts unthrottled again',
  (await page.locator('#proof [role="radio"][aria-checked="true"]').innerText()).trim() === 'Normal',
)

/* --------------------------------------------------------------- section two */

const repo = await page.locator('#source a[href*="github.com"]').first().getAttribute('href')
check('the second section links to the repository', repo === 'https://github.com/UtkukaanSCK/X-Player', repo ?? '(none)')
check(
  'the link opens safely in a new tab',
  (await page.locator('#source a[href*="github.com"]').first().getAttribute('rel'))?.includes('noopener') === true,
)

/* ------------------------------------------------------------------ the basics */

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(800)
const narrow = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  sideBySide: (() => {
    const panels = document.querySelectorAll('#proof [data-panel]')
    if (panels.length !== 2) return false
    const [a, b] = [...panels].map((p) => p.getBoundingClientRect())
    return Math.abs(a.top - b.top) < 4
  })(),
}))
check('no horizontal overflow on a phone', narrow.overflow <= 1, `${narrow.overflow}px`)
check('the two players stay side by side on a phone', narrow.sideBySide, 'stacked, they are not a comparison')

check('no uncaught errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nproof: all checks passed')
