/**
 * Verifies what the comparison section actually claims.
 *
 * Drives the live section the way a visitor does - pick a condition, watch both
 * sides - and asserts the difference is real: on a degraded link X-Player tells
 * you what is happening and offers a way back, while the bare <video> stops with
 * no explanation. Nothing here is mocked; the service worker on the page shapes
 * real bytes for both players equally.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message)))

const read = () =>
  page.evaluate(() => {
    const pick = (v) =>
      v
        ? {
            paused: v.paused,
            t: +v.currentTime.toFixed(2),
            ready: v.readyState,
            err: v.error?.code ?? null,
            buffered: v.buffered.length ? +(v.buffered.end(v.buffered.length - 1) - v.currentTime).toFixed(1) : 0,
          }
        : null
    const featured = '.compare-side.is-featured'
    return {
      plain: pick(document.querySelector('.compare-side:not(.is-featured) video')),
      player: pick(document.querySelector(`${featured} video`)),
      spinner: document.querySelectorAll(`${featured} .xp-spinner`).length,
      errorCard: document.querySelectorAll(`${featured} .xp-error`).length,
      retryButton: document.querySelectorAll(`${featured} .xp-error-retry`).length,
      errorText: document.querySelector(`${featured} .xp-error-text`)?.textContent ?? null,
    }
  })

const setMode = async (label) => {
  await page.locator('.sim-btn', { hasText: label }).click()
  await page.waitForTimeout(300)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('#compare').scrollIntoViewIfNeeded()
// The worker only shapes traffic once it controls the page.
await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20000 })
await page.waitForTimeout(400)

check('simulator controls are enabled', await page.locator('.sim-btn').first().isEnabled())

/* ------------------------------------------------------------ normal */

await page.locator('.sim-play').click()
await page.waitForTimeout(3000)
const normal = await read()
check('both play on a good connection', !normal.plain.paused && !normal.player.paused, JSON.stringify(normal.player))

/* ----------------------------------------------------------- slow 3G */

await setMode('Slow 2G')
// The buffer drains rather than vanishing, so poll for the moment playback
// actually runs dry instead of guessing at a sleep duration.
// Playback stutters rather than dying here, so watch for the moment the
// spinner is actually raised instead of sampling once.
let slow = await read()
let sawSpinner = slow.spinner > 0
for (let i = 0; i < 30 && !sawSpinner; i++) {
  await page.waitForTimeout(400)
  slow = await read()
  if (slow.spinner > 0) sawSpinner = true
}
check('X-Player raises a spinner while starved', sawSpinner, `ready=${slow.player.ready}`)
check('X-Player raises no error for slowness alone', slow.errorCard === 0)
await page.screenshot({ path: 'scripts/e2e/out/netsim-slow.png' }).catch(() => {})

/* ----------------------------------------------------------- offline */

await setMode('Offline')
await page.waitForTimeout(9000)
const off = await read()
check('plain video is dead', off.plain.err !== null || off.plain.ready === 0, JSON.stringify(off.plain))
check('X-Player explains the failure', off.errorCard > 0, off.errorText ?? '(no card)')
check('X-Player offers a way back', off.retryButton > 0)
await page.screenshot({ path: 'scripts/e2e/out/netsim-offline.png' }).catch(() => {})

/* -------------------------------------------------------- recovery */

await setMode('Normal')
await page.waitForTimeout(2000)
const afterRestore = await read()
if (afterRestore.retryButton > 0) {
  await page.locator('.compare-side.is-featured .xp-error-retry').click()
  await page.waitForTimeout(4000)
}
const recovered = await read()
check('X-Player plays again once the link is back', recovered.player.ready >= 3 && recovered.errorCard === 0, JSON.stringify(recovered.player))
check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '))
await page.screenshot({ path: 'scripts/e2e/out/netsim-recovered.png' }).catch(() => {})

await browser.close()
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nnetsim: all checks passed')
