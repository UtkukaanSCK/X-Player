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
/*
 * Behind real time by a clear margin, expressed as a fraction of the clock
 * rather than a number of seconds. The old constant was 4, tuned against the
 * 854x480 encode; the clip is 480x270 now and the same throttle ratio leaves
 * the player further ahead, because a smaller file buys more seconds of video
 * per buffered byte. Measured across two runs it is 2.7s for the plain video
 * and 4.2s for the player against 8s of clock - a third and a half. Unthrottled
 * both take about the full 8, which is what this separates.
 *
 * That the player does better is the section's whole claim, and the check
 * below is what keeps it from being an unfair fight.
 */
const CRAWLING = 8 * 0.6
check(
  'the throttle really bites: both crawl well behind real time',
  bareRate < CRAWLING && xpRate < CRAWLING,
  `8 s of wall clock bought ${bareRate.toFixed(1)} s and ${xpRate.toFixed(1)} s of video`,
)
check(
  'neither is given an advantage over the other',
  Math.abs(bareRate - xpRate) < 3,
  `${bareRate.toFixed(1)} s vs ${xpRate.toFixed(1)} s`,
)

/* ------------------------------------------------ nothing plays unwatched */

/*
 * Scrolled past, both players stop, and both start again on the way back.
 *
 * They used not to agree about this: the plain video stopped on its own and
 * the player kept decoding, which is a browser heuristic rather than anyone
 * deciding. Checked in both directions, because stopping them is easy and a
 * comparison that never restarts is worse than one that never stops.
 *
 * The section is 200svh with a sticky interior, so this has to scroll past
 * the whole of it - scrolling within it keeps both on screen, which is the
 * point of the sticky.
 */
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }))
await page.waitForTimeout(2500)
const parked = await readBoth()
check(
  'scrolled past, neither player is still decoding',
  parked.bare.paused === true && parked.xp.paused === true,
  JSON.stringify(parked),
)

await page.waitForTimeout(4000)
const stillParked = await readBoth()
check(
  'and neither creeps forward while away',
  stillParked.bare.t - parked.bare.t < 0.3 && stillParked.xp.t - parked.xp.t < 0.3,
  `bare ${parked.bare.t} -> ${stillParked.bare.t}, xp ${parked.xp.t} -> ${stillParked.xp.t}`,
)

await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
await page.waitForTimeout(3000)
const resumed = await readBoth()
check(
  'coming back starts both of them again',
  resumed.bare.paused === false && resumed.xp.paused === false,
  JSON.stringify(resumed),
)

/* ------------------------------------------ the numbers describe the file */

/*
 * The section makes three numeric claims and all of them are about one clip:
 * what it needs, what Normal gives it, and what Slow 2G does not. They are
 * only true of the encode actually shipped, and re-encoding that clip is how
 * they quietly stop being true - it happened once already, when a list said
 * 50 for a clip that needed 48.
 *
 * So the number is derived rather than trusted: the file the page is playing,
 * its own content-length, over the duration the element reports.
 */
/*
 * Only the selected mode shows its own detail line, so the three figures
 * cannot be read from one state. Each is read with its own mode chosen.
 */
const readDetail = async (label, pattern) => {
  await page.locator('#proof [role="radio"]', { hasText: label }).first().click()
  await page.waitForTimeout(700)
  return page.evaluate((source) => {
    const text = document.querySelector('#proof').textContent ?? ''
    const found = text.match(new RegExp(source))
    return found ? Number(found[1]) : null
  }, pattern)
}

const needs = await readDetail('Normal', '([0-9]+) kB.s the clip needs')
const normal = await readDetail('Normal', '([0-9]+) kB.s . comfortably above')
const slow = await readDetail('Slow 2G', '([0-9]+) kB.s . a third')

const real = await page.evaluate(async () => {
  const video = document.querySelector('#proof video')
  const head = await fetch(video.currentSrc, { method: 'HEAD' })
  return {
    file: video.currentSrc.split('/').pop(),
    rate: Number(head.headers.get('content-length')) / video.duration / 1024,
  }
})

/* Put it back, so what follows starts where it used to. */
await page.locator('#proof [role="radio"]', { hasText: 'Normal' }).first().click()
await page.waitForTimeout(600)
check(
  'the page says what the clip actually needs',
  needs !== null && Math.abs(real.rate - needs) < 2,
  `${real.file} really needs ${real.rate.toFixed(1)} kB/s, the page says ${needs}`,
)
check(
  'and the throttle it calls comfortable is above that',
  normal !== null && normal > real.rate * 1.2,
  `${normal} vs ${real.rate.toFixed(1)}`,
)
check(
  'and the one it calls a third really is about a third',
  slow !== null && Math.abs(slow / real.rate - 1 / 3) < 0.12,
  `${slow} is ${(slow / real.rate).toFixed(2)} of ${real.rate.toFixed(1)}`,
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

/*
 * Both players default to the small encode, everywhere.
 *
 * Not because every box needs it - a wide one could show more - but because
 * the section's three figures are ratios against one clip's bitrate, and a
 * second encode in play would leave one of them described by the other's
 * numbers. The larger is still offered, so nobody is stuck with the small one.
 */
const playing = await page.evaluate(() =>
  [...document.querySelectorAll('#proof video')].map((v) => v.currentSrc.split('/').pop()),
)
check(
  'both players default to the same small encode',
  playing.length === 2 && playing.every((name) => name === 'demo-480.mp4'),
  playing.join(', '),
)

/* --------------------------------------------------- the metered-link path */

/*
 * The comparison costs about six megabytes, because two players streaming
 * the same two-minute clip is what it is. On a connection that has asked to be
 * spent carefully it must build the apparatus and wait, and it must say the
 * number rather than spending it and explaining afterwards.
 *
 * Both directions are checked. A guard that holds everything back is easy and
 * useless; the one that matters is that nobody else is affected.
 */
for (const saveData of [true, false]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript((on) => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => ({ saveData: on, effectiveType: '4g' }),
    })
  }, saveData)
  const metered = await context.newPage()
  let videoBytes = 0
  metered.on('response', (res) => {
    if ((res.headers()['content-type'] ?? '').startsWith('video/')) {
      videoBytes += Number(res.headers()['content-length'] ?? 0)
    }
  })
  await metered.goto(BASE, { waitUntil: 'domcontentloaded' })
  await metered.waitForTimeout(6000)
  const state = await metered.evaluate(() => ({
    loading: [...document.querySelectorAll('#proof video')].filter((v) => v.currentSrc).length,
    saysCost: (document.querySelector('#proof')?.textContent ?? '').includes('6 MB'),
  }))

  if (saveData) {
    check('a metered link downloads nothing until asked', state.loading === 0 && videoBytes === 0, `${state.loading} players, ${videoBytes} bytes`)
    check('and it says what pressing the button will cost', state.saysCost)
    await metered.locator('#proof button', { hasText: 'Play the comparison' }).click()
    await metered.waitForTimeout(6000)
    const started = await metered.evaluate(() => [...document.querySelectorAll('#proof video')].filter((v) => v.currentSrc).length)
    check('pressing it runs the comparison', started === 2, `${started} players`)
  } else {
    check('an ordinary link is not held back', state.loading === 2 && videoBytes > 0, `${state.loading} players, ${(videoBytes / 1048576).toFixed(1)} MB`)
  }
  await context.close()
}

check('no uncaught errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nproof: all checks passed')
