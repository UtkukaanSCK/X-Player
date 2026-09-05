/**
 * Exercises the player through the development harness the way a person would:
 * press play, drag the bar, use the keyboard, open the menu, switch quality,
 * turn subtitles on.
 */
import { chromium, devices } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const V = '[data-case="ladder"] video.xp-video'
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
await page.locator('#ladder').scrollIntoViewIfNeeded()
await page.waitForTimeout(1500)

check('player mounted', (await page.locator('[data-case="ladder"] .xp-root').count()) === 1)
const meta = await state()
check('metadata loaded', meta.dur !== null && meta.err === null, JSON.stringify(meta))

/* ------------------------------------------------------------- playback */

await page.locator('[data-case="ladder"] .xp-bigplay').click()
await page.waitForTimeout(2500)
const playing = await state()
check('plays', !playing.paused && playing.t > 0.5, JSON.stringify(playing))

check(
  'progress bar is painted directly to the DOM',
  await page.evaluate(() => {
    const el = document.querySelector('[data-case="ladder"] .xp-seek-played')
    return !!el && /scaleX\(0?\.[0-9]/.test(el.style.transform)
  }),
)

/* ------------------------------------------------------------- keyboard */

await page.locator('[data-case="ladder"] .xp-root').focus()
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

const bar = await page.locator('[data-case="ladder"] .xp-seek').boundingBox()
await page.mouse.move(bar.x + bar.width * 0.1, bar.y + bar.height / 2)
await page.mouse.down()
await page.mouse.move(bar.x + bar.width * 0.6, bar.y + bar.height / 2, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(700)
const scrubbed = await state()
check('dragging seeks to roughly 60%', scrubbed.t / scrubbed.dur > 0.45 && scrubbed.t / scrubbed.dur < 0.75, `${scrubbed.t}/${scrubbed.dur}`)

/* ---------------------------------------------------------------- menu */

await page.locator('[data-case="ladder"] .xp-root').hover()
await page.locator('[data-case="ladder"] .xp-settings .xp-btn').click()
await page.waitForTimeout(300)
check('settings menu opens', (await page.locator('[data-case="ladder"] .xp-menu').count()) > 0)
await page.locator('[data-case="ladder"] .xp-menu-item', { hasText: 'Playback speed' }).click()
await page.waitForTimeout(250)
await page.locator('[data-case="ladder"] .xp-menu-option', { hasText: '1.5x' }).click()
await page.waitForTimeout(300)
check('speed changes to 1.5x', (await state()).rate === 1.5)
await page.keyboard.press('Escape')

/* ------------------------------------------ controls vs. keyboard focus */

/*
 * The order here is the bug: focusing clears the hide timer, and the pointer
 * move that follows re-arms it. Guarding only the pointerleave handler left
 * that timer free to hide a focused control 2.5s later, so the pointer never
 * has to leave the player for this to fail.
 */
const SHOWING = '[data-case="ladder"] .xp-root.xp-show'
const rootBox = await page.locator('[data-case="ladder"] .xp-root').boundingBox()
const nudge = async () => {
  await page.mouse.move(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
  await page.mouse.move(rootBox.x + rootBox.width / 2 + 4, rootBox.y + rootBox.height / 2)
}

// A paused player keeps its controls up for an unrelated reason, which would
// make both checks below pass without proving anything. Rewind as well: the
// clip runs 14s, and the two waits below would otherwise reach the end of it
// and pause for that reason instead.
await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  v.currentTime = 0
  return v.play()
}, V)
await page.waitForTimeout(500)

// Proves the hide timer is running here at all, so the check after it cannot
// pass by accident.
await page.evaluate(() => document.activeElement?.blur())
await nudge()
await page.waitForTimeout(3200)
check('controls fade out with nothing focused', (await page.locator(SHOWING).count()) === 0)

await page.locator('[data-case="ladder"] .xp-settings .xp-btn').focus()
await nudge()
await page.waitForTimeout(3200)
check('controls stay up while a control has focus', (await page.locator(SHOWING).count()) === 1)
await page.evaluate(() => document.activeElement?.blur())

/* ----------------------------------------------------------- subtitles */

await page.locator('[data-case="ladder"] .xp-root').focus()
await page.keyboard.press('c')
await page.waitForTimeout(500)
const cue = await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  const t = Array.from(v.textTracks).find((tt) => tt.mode === 'showing')
  return t ? t.label : null
}, V)
check('C turns subtitles on', cue !== null, cue ?? '(none)')

/* --------------------------------------------- progressive quality ladder */

// Quality has its own button on the bar: reaching it must take one click, not a
// trip through the settings menu.
await page.keyboard.press('Escape')
await page.locator('[data-case="ladder"] .xp-root').hover()
const qualityBtn = page.locator('[data-case="ladder"] .xp-quality .xp-btn-text')
check('quality has its own button on the bar', (await qualityBtn.count()) === 1)
check('the button names the current rendition', (await qualityBtn.textContent())?.includes('480p'), await qualityBtn.textContent())

await qualityBtn.click()
await page.waitForTimeout(300)
const ladder = await page.locator('[data-case="ladder"] .xp-quality .xp-menu-option').allTextContents()
check('one click lists every encode supplied', ladder.length === 3, ladder.join(', '))

// Pause and seek first: then nothing but the switch itself can move the position.
await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  v.pause()
  v.currentTime = 7
}, V)
await page.waitForTimeout(500)
const beforeSwitch = await state()
await page.locator('[data-case="ladder"] .xp-quality .xp-menu-option', { hasText: '240p' }).click()
await page.waitForTimeout(2500)
const afterSwitch = await state()
const switchedFile = await page.evaluate((sel) => document.querySelector(sel).currentSrc.includes('240p'), V)
check('switching quality loads the other file', switchedFile)
check(
  'switching quality keeps your place',
  Math.abs(afterSwitch.t - beforeSwitch.t) < 0.8,
  `${beforeSwitch.t} -> ${afterSwitch.t}`,
)
check('the button follows the switch', (await qualityBtn.textContent())?.includes('240p'), await qualityBtn.textContent())

// Subtitles belong to the video, not the rendition, so they must survive it.
await page.locator('[data-case="ladder"] .xp-settings .xp-btn').click()
await page.waitForTimeout(300)
const settingsRows = await page.locator('[data-case="ladder"] .xp-settings .xp-menu-item').allTextContents()
check('subtitles survive a quality switch', settingsRows.some((r) => r.startsWith('Subtitles')), settingsRows.join(' | '))
check('quality is not duplicated in settings', !settingsRows.some((r) => r.startsWith('Quality')), settingsRows.join(' | '))
await page.keyboard.press('Escape')

/* ----------------------------------------------------------------- HLS */

const HLS = '[data-case="hls"]'
await page.locator(HLS).scrollIntoViewIfNeeded()
await page.waitForTimeout(7000)
const hls = await page.evaluate((sel) => {
  const v = document.querySelector(sel)
  return { dur: Number.isFinite(v.duration) ? Math.round(v.duration) : null, err: v.error?.code ?? null }
}, `${HLS} video.xp-video`)
check('HLS stream loads', hls.dur !== null && hls.err === null, JSON.stringify(hls))
await page.locator(`${HLS} .xp-root`).hover()
const hlsQuality = page.locator(`${HLS} .xp-quality .xp-btn-text`)
check('the same button serves HLS', (await hlsQuality.count()) === 1)
await hlsQuality.click()
await page.waitForTimeout(400)
const levels = await page.locator(`${HLS} .xp-quality .xp-menu-option`).allTextContents()
check('stream renditions are listed', levels.length > 2, levels.join(', '))
check('automatic is offered first', levels[0].startsWith('Auto'), levels[0])

/* ------------------------------------------------------- single source */

// With one file there is nothing to choose between, so the control must not
// appear at all rather than showing a list of one.
await page.locator('[data-case="single"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await page.locator('[data-case="single"] .xp-root').hover()
check(
  'a single source shows no quality button',
  (await page.locator('[data-case="single"] .xp-quality').count()) === 0,
)

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
