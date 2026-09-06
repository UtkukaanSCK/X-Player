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

/*
 * The play button removes itself the moment playback starts, and focus went
 * with it - to the document body, where none of the shortcuts are listening.
 * Every key was dead from then on for anyone who started a video the obvious
 * way, which is why the 5-second skip looked unreliable rather than broken:
 * click the picture and it worked, press the button and it did not.
 *
 * This has to be checked here, before the keyboard section below focuses the
 * player by hand. That call is exactly what hid this for so long.
 */
check(
  'the keyboard survives the play button removing itself',
  await page.evaluate(() => {
    const root = document.querySelector('[data-case="ladder"] .xp-root')
    return document.activeElement !== document.body && root.contains(document.activeElement)
  }),
)

const beforeSkip = (await state()).t
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(500)
const afterSkip = (await state()).t
check(
  'the 5s skip works without focusing the player by hand',
  afterSkip - beforeSkip > 3.5 && afterSkip - beforeSkip < 6.5,
  `${beforeSkip} -> ${afterSkip}`,
)

/* Put it back where it was: the checks below start from here. */
await page.evaluate(
  ([sel, t]) => {
    document.querySelector(sel).currentTime = t
  },
  [V, beforeSkip],
)
await page.waitForTimeout(300)

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

/* ------------------------------------------------------- frame preview */

/*
 * The frame is drawn from a second, hidden copy of the video, so the check
 * that matters is not that a canvas exists but that what is on it is the
 * video at that moment. Compared against the real element seeked to the same
 * time: a blank canvas, a stale frame or the wrong second all fail it. The lit
 * check is not redundant - without it, a canvas that was never drawn and a
 * scene that happens to be black would agree perfectly.
 */
await page.mouse.move(bar.x + bar.width * 0.75, bar.y + bar.height / 2)
await page.waitForTimeout(1200)
const preview = await page.evaluate(async (sel) => {
  const canvas = document.querySelector(`${sel} .xp-seek-frame`)
  if (!canvas || canvas.hidden || !canvas.width) return null
  const video = document.querySelector(`${sel} video.xp-video`)
  const scratch = document.createElement("canvas")
  scratch.width = canvas.width
  scratch.height = canvas.height
  await new Promise((done) => {
    video.addEventListener("seeked", done, { once: true })
    video.currentTime = video.duration * 0.75
  })
  await new Promise((done) => setTimeout(done, 300))
  scratch.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)
  const want = scratch.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
  const got = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
  let diff = 0
  let lit = 0
  for (let p = 0; p < want.length; p += 4) {
    diff += (Math.abs(want[p] - got[p]) + Math.abs(want[p + 1] - got[p + 1]) + Math.abs(want[p + 2] - got[p + 2])) / 3
    if (got[p] + got[p + 1] + got[p + 2] > 30) lit += 1
  }
  return { diff: diff / (want.length / 4), litPct: (lit / (want.length / 4)) * 100 }
}, "[data-case=\"ladder\"]")

check('hovering the bar draws the frame under the pointer', preview !== null && preview.litPct > 5, JSON.stringify(preview))
check(
  'the drawn frame is the video at that time',
  preview !== null && preview.diff < 60,
  preview && `mean channel difference ${preview.diff.toFixed(1)}`,
)

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

/*
 * A stream opts out of frame previews. Drawing them would mean a second
 * hls.js and a second buffer for a thumbnail, which costs more than the
 * feature is worth. The time must still be there: opting out of the picture
 * is not opting out of the tooltip.
 */
await page.keyboard.press('Escape')
const hlsBar = await page.locator(`${HLS} .xp-seek`).boundingBox()
await page.mouse.move(hlsBar.x + hlsBar.width * 0.5, hlsBar.y + hlsBar.height / 2)
await page.waitForTimeout(1000)
const streamTip = await page.evaluate((sel) => {
  const root = document.querySelector(sel)
  const tip = root.querySelector('.xp-seek-tip')
  return {
    frame: !!root.querySelector('.xp-seek-frame'),
    time: tip && getComputedStyle(tip).display !== 'none' ? tip.textContent.trim() : null,
  }
}, HLS)
check('a stream draws no frame preview', streamTip.frame === false, JSON.stringify(streamTip))
check('a stream still shows the time under the pointer', /^[0-9]+:[0-9][0-9]/.test(streamTip.time ?? ''), streamTip.time)

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
