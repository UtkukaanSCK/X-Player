/**
 * Exercises the player through the site's playground the way a person would:
 * press play, drag the bar, use the keyboard, open the menu, switch quality,
 * turn subtitles on.
 */
import { chromium, devices } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
const V = '.play-stage video.xp-video'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message)))

const state = () =>
  page.evaluate((sel) => {
    const v = document.querySelector(sel)
    return v
      ? {
          paused: v.paused,
          t: +v.currentTime.toFixed(2),
          dur: Number.isFinite(v.duration) ? Math.round(v.duration) : null,
          ready: v.readyState,
          rate: v.playbackRate,
          muted: v.muted,
          err: v.error?.code ?? null,
        }
      : null
  }, V)

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('#try').scrollIntoViewIfNeeded()
await page.waitForTimeout(1500)

check('player mounted', (await page.locator('.play-stage .xp-root').count()) === 1)
const meta = await state()
check('metadata loaded', meta.dur !== null && meta.err === null, JSON.stringify(meta))

/* ------------------------------------------------------------- playback */

await page.locator('.play-stage .xp-bigplay').click()
await page.waitForTimeout(2500)
const playing = await state()
check('plays', !playing.paused && playing.t > 0.5, JSON.stringify(playing))

check(
  'progress bar is painted directly to the DOM',
  await page.evaluate(() => {
    const el = document.querySelector('.play-stage .xp-seek-played')
    return !!el && /scaleX\(0?\.[0-9]/.test(el.style.transform)
  }),
)

/* ------------------------------------------------------------- keyboard */

await page.locator('.play-stage .xp-root').focus()
const before = (await state()).t
await page.keyboard.press('l')
await page.waitForTimeout(500)
const after = (await state()).t
check('L skips forward 10s', after - before > 8 && after - before < 12, `${before} -> ${after}`)

await page.keyboard.press(' ')
await page.waitForTimeout(400)
check('space pauses', (await state()).paused)

await page.keyboard.press('m')
await page.waitForTimeout(300)
check('M mutes', (await state()).muted)
await page.keyboard.press('m')

/* ---------------------------------------------------------------- seek */

const bar = await page.locator('.play-stage .xp-seek').boundingBox()
await page.mouse.move(bar.x + bar.width * 0.1, bar.y + bar.height / 2)
await page.mouse.down()
await page.mouse.move(bar.x + bar.width * 0.6, bar.y + bar.height / 2, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(700)
const scrubbed = await state()
check('dragging seeks to roughly 60%', scrubbed.t / scrubbed.dur > 0.45 && scrubbed.t / scrubbed.dur < 0.75, `${scrubbed.t}/${scrubbed.dur}`)

/* ---------------------------------------------------------------- menu */

await page.locator('.play-stage .xp-root').hover()
await page.locator('.play-stage .xp-settings .xp-btn').click()
await page.waitForTimeout(300)
check('settings menu opens', (await page.locator('.play-stage .xp-menu').count()) > 0)
await page.locator('.play-stage .xp-menu-item', { hasText: 'Playback speed' }).click()
await page.waitForTimeout(250)
await page.locator('.play-stage .xp-menu-option', { hasText: '1.5x' }).click()
await page.waitForTimeout(300)
check('speed changes to 1.5x', (await state()).rate === 1.5)
await page.keyboard.press('Escape')

/* ----------------------------------------------------------- subtitles */

await page.locator('.play-stage .xp-root').focus()
await page.keyboard.press('c')
await page.waitForTimeout(500)
const cue = await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  const t = Array.from(v.textTracks).find((tt) => tt.mode === 'showing')
  return t ? t.label : null
}, V)
check('C turns subtitles on', cue !== null, cue ?? '(none)')

/* --------------------------------------------- progressive quality ladder */

// Several files of the same video is the other half of "quality": with only one
// file there is nothing to choose between, so the menu stays out of the way.
await page.locator('.play-stage .xp-root').hover()
// Open the menu only if it is not already open: clicking the button toggles it.
if ((await page.locator('.play-stage .xp-menu').count()) === 0) {
  await page.locator('.play-stage .xp-settings .xp-btn').click()
  await page.waitForTimeout(250)
}
await page.locator('.play-stage .xp-menu-item', { hasText: 'Quality' }).click()
await page.waitForTimeout(250)
const ladder = await page.locator('.play-stage .xp-menu-option').allTextContents()
check('quality lists every encode supplied', ladder.length === 3, ladder.join(', '))

// Pause and seek first: then nothing but the switch itself can move the position.
await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  v.pause()
  v.currentTime = 7
}, V)
await page.waitForTimeout(500)
const beforeSwitch = await state()
await page.locator('.play-stage .xp-menu-option', { hasText: '240p' }).click()
await page.waitForTimeout(2500)
const afterSwitch = await state()
const switchedFile = await page.evaluate((sel) => document.querySelector(sel).currentSrc.includes('240p'), V)
check('switching quality loads the other file', switchedFile)
check(
  'switching quality keeps your place',
  Math.abs(afterSwitch.t - beforeSwitch.t) < 0.8,
  `${beforeSwitch.t} -> ${afterSwitch.t}`,
)

/* ----------------------------------------------------------------- HLS */

await page.locator('.sample', { hasText: 'HLS stream' }).click()
await page.waitForTimeout(7000)
const hls = await state()
check('HLS stream loads', hls.dur !== null && hls.err === null, JSON.stringify(hls))
await page.locator('.play-stage .xp-root').hover()
await page.locator('.play-stage .xp-settings .xp-btn').click()
await page.waitForTimeout(400)
const qualityRow = page.locator('.play-stage .xp-menu-item', { hasText: 'Quality' })
check('quality menu appears for HLS', (await qualityRow.count()) > 0)
if (await qualityRow.count()) {
  await qualityRow.click()
  await page.waitForTimeout(300)
  const levels = await page.locator('.play-stage .xp-menu-option').allTextContents()
  check('renditions are listed', levels.length > 2, levels.join(', '))
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '))
await page.close()

/* -------------------------------------------------------------- mobile */

const phone = await browser.newPage({ ...devices['iPhone 13'] })
await phone.goto(BASE, { waitUntil: 'networkidle' })
await phone.waitForTimeout(1500)
check(
  'no horizontal overflow on a phone',
  !(await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
)
check('controls are reachable on a phone', (await phone.locator('.xp-controls').count()) > 0)
await phone.close()

await browser.close()
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nplayer: all checks passed')
